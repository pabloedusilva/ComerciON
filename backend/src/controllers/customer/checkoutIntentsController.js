const { pool } = require('../../config/database');
const Product = require('../../models/Product');
const { buildCheckoutLink, hmacSign } = require('../../services/payment/infinityPayService');

function resolveCouponPercentServer(code){
  if (!code) return 0; const up = String(code).trim().toUpperCase(); if (up==='SITE10') return 10; return 0;
}

async function computeTotals(items, addr, coupon) {
  let entrega = 5.0;
  try {
    const city = addr?.cidade || addr?.city; const uf = (addr?.estado||'').toUpperCase();
    if (city && uf) {
      const DeliveryArea = require('../../models/DeliveryArea');
      const area = await DeliveryArea.findByCityState(city, uf); if (area && typeof area.fee==='number') entrega = Number(area.fee);
    }
  } catch(_){}
  const produtosValor = items.reduce((a,it)=> a + it.unit_price * it.quantity, 0);
  const subtotal = produtosValor + entrega;
  const pct = resolveCouponPercentServer(coupon);
  const desconto = pct>0 ? subtotal * (pct/100) : 0;
  const total = subtotal - desconto;
  return { subtotal, entrega, desconto, total };
}

function sanitizeAddress(raw, user){
  const s = (v,m=120)=>{ if(v==null) return null; const t=String(v).trim(); if(!t) return null; return t.length>m? t.slice(0,m): t; };
  if (raw && typeof raw==='object') {
    return {
      nome: s(raw.nome)||s(user.nome), telefone: s(raw.telefone)||s(user.telefone), endereco:s(raw.endereco), numero:s(raw.numero,20), complemento:s(raw.complemento), bairro:s(raw.bairro), cidade:s(raw.cidade), estado:s(raw.estado,2)?.toUpperCase()||null, cep:s(raw.cep,12)
    };
  }
  return {
    nome:s(user.nome), telefone:s(user.telefone), endereco:s(user.endereco), numero:s(user.numero,20), complemento:s(user.complemento), bairro:s(user.bairro), cidade:s(user.cidade), estado:s(user.estado,2)?.toUpperCase()||null, cep:s(user.cep,12)
  };
}

module.exports = {
  // POST /api/customer/checkout-intents
  createIntent: async (req,res)=>{
    try {
      const user = req.usuario; const body=req.body||{}; const rawItems = Array.isArray(body.items)? body.items: [];
      if (!rawItems.length) return res.status(400).json({sucesso:false,mensagem:'Itens obrigatórios'});
      const prepared = [];
      for (const it of rawItems){
        const id = parseInt(it.id,10); const size = parseInt(it.size,10); const quantity = parseInt(it.qt||it.quantity||0,10);
        const removed = (it.removedIngredients||'').toString().slice(0,200)||null;
        if(!id || !Number.isFinite(size) || size<0 || size>2 || !quantity || quantity<1) return res.status(400).json({sucesso:false,mensagem:'Item inválido'});
        const product = await Product.findById(id); if(!product) return res.status(400).json({sucesso:false,mensagem:'Produto não encontrado'});
        if(product.status && product.status!=='active') return res.status(400).json({sucesso:false,mensagem:'Produto inativo'});
        const unitPrice = Array.isArray(product.price)? Number(product.price[size]): Number(product.price?.[size]);
        if(!Number.isFinite(unitPrice)) return res.status(400).json({sucesso:false,mensagem:'Preço inválido'});
        prepared.push({ product_id:id, category:(product.category?String(product.category).toLowerCase().slice(0,50):'produto'), size, quantity, unit_price:unitPrice, removed_ingredients: removed, name_snapshot: product.name });
      }
      const addr = sanitizeAddress(body.address, user);
      const couponCode = (body.couponCode||body.coupon?.code||'').toString().trim()||null;
      const totals = await computeTotals(prepared, addr, couponCode);
      const expiresMinutes = 30;
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [r] = await conn.query(`INSERT INTO checkout_intents (user_id, status, subtotal, delivery_fee, discount, total, address_json, coupon_code, expires_at) VALUES (?,?,?,?,?,?,?,?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`, [user.id, 'iniciada', totals.subtotal, totals.delivery_fee || totals.entrega || 0, totals.desconto, totals.total, JSON.stringify(addr), couponCode, expiresMinutes]);
        const intentId = r.insertId;
        const values=[]; const ph=[];
        for(const it of prepared){ ph.push('(?,?,?,?,?,?,?,?)'); values.push(intentId, it.product_id, it.category, it.size, it.quantity, it.unit_price, it.removed_ingredients, it.name_snapshot||null); }
        await conn.query(`INSERT INTO checkout_intent_items (intent_id, product_id, category, size, quantity, unit_price, removed_ingredients, name_snapshot) VALUES ${ph.join(',')}`, values);
        await conn.commit();
        return res.json({sucesso:true,data:{ intentId, totals }});
      } catch(e){ await conn.rollback(); throw e; } finally { conn.release(); }
    } catch(e){ console.error('Erro createIntent', e); return res.status(500).json({sucesso:false,mensagem:'Falha ao criar intent'}); }
  },

  // GET /api/customer/checkout-intents/:id
  getIntent: async (req,res)=>{
    try { const userId=req.usuario.id; const id=parseInt(req.params.id,10); if(!id) return res.status(400).json({sucesso:false,mensagem:'ID inválido'});
      const [[row]] = await pool.query('SELECT * FROM checkout_intents WHERE id=? AND user_id=?',[id,userId]);
      if(!row) return res.status(404).json({sucesso:false,mensagem:'Intent não encontrada'});
      return res.json({sucesso:true,data:row});
    } catch(e){ return res.status(500).json({sucesso:false,mensagem:'Erro'}); }
  },

  // POST /api/customer/checkout-intents/:id/generate-link
  generateLink: async (req,res)=>{
    try { const userId=req.usuario.id; const id=parseInt(req.params.id,10); if(!id) return res.status(400).json({sucesso:false,mensagem:'ID inválido'});
      const [[intent]] = await pool.query('SELECT * FROM checkout_intents WHERE id=? AND user_id=?',[id,userId]);
      if(!intent) return res.status(404).json({sucesso:false,mensagem:'Intent não encontrada'});
      if(intent.status!=='iniciada' && intent.status!=='link_gerado') return res.status(400).json({sucesso:false,mensagem:'Estado inválido'});
      if (intent.expires_at && new Date(intent.expires_at) < new Date()) return res.status(400).json({sucesso:false,mensagem:'Intent expirada'});
      const [items] = await pool.query('SELECT product_id, size, quantity, unit_price, name_snapshot, removed_ingredients, category FROM checkout_intent_items WHERE intent_id=?', [id]);
      if(!items.length) return res.status(400).json({sucesso:false,mensagem:'Sem itens'});
      const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
      // Mapear itens para formato InfinitePay (mesma lógica simplificada)
      const toCents = v=> Math.max(1, Math.round(Number(v||0)*100));
      const mapped = items.map(it=>({ name: `${it.name_snapshot||'Produto'}${it.quantity>1?` x${it.quantity}`:''}`, price: toCents(it.unit_price*it.quantity), quantity:1 }));
      // Delivery e desconto: reconstruir
      const subtotalCents = toCents(intent.subtotal);
      const deliveryCents = toCents(intent.delivery_fee);
      const discountCents = toCents(intent.discount);
      let lines = [...mapped]; if (deliveryCents>0) lines.push({ name:'Entrega', price:deliveryCents, quantity:1 });
      // Ajustar desconto distribuindo proporcionalmente (simples: aplicar no último item)
      if (discountCents>0 && lines.length){ lines[lines.length-1].price = Math.max(1, lines[lines.length-1].price - discountCents); }
      const sumNow = lines.reduce((a,it)=> a+Number(it.price||0),0);
      const totalCents = toCents(intent.total);
      const delta = totalCents - sumNow; if (delta!==0 && lines.length){ lines[lines.length-1].price = Math.max(1, lines[lines.length-1].price + delta); }
      const handle = process.env.INFINITEPAY_HANDLE || '$pablo_eduardo_';
      const hmacSecret = process.env.INFINITEPAY_HMAC_SECRET || process.env.JWT_SECRET;
      const link = buildCheckoutLink({ handle, items: lines, orderNSU: String(`I${id}`), redirectBaseUrl: baseUrl, successPath:'/pay/sucesso', hmacSecret });
      if (intent.status==='iniciada') await pool.query('UPDATE checkout_intents SET status = ? WHERE id = ?', ['link_gerado', id]);
      return res.json({sucesso:true,url:link});
    } catch(e){ console.error('Erro generateLink',e); return res.status(500).json({sucesso:false,mensagem:'Falha gerar link'}); }
  },

  // GET /api/customer/checkout-intents/:id/status
  pollStatus: async (req,res)=>{
    try { const userId=req.usuario.id; const id=parseInt(req.params.id,10); if(!id) return res.status(400).json({sucesso:false});
      const [[row]] = await pool.query('SELECT status, txid FROM checkout_intents WHERE id=? AND user_id=?',[id,userId]);
      if(!row) return res.status(404).json({sucesso:false});
      return res.json({sucesso:true,data:row});
    } catch(e){ return res.status(500).json({sucesso:false}); }
  }
};