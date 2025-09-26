(function(){
  const LS_TOKEN = 'admin_token';
  const API = {
    async getOrderDetail(id){
      const token = localStorage.getItem(LS_TOKEN);
      const resp = await fetch(`/api/admin/orders/${id}`, { headers: { 'Authorization': token ? `Bearer ${token}` : '' } });
      const json = await resp.json();
      if (!resp.ok || !json?.sucesso) throw new Error(json?.mensagem || 'Falha ao buscar pedido');
      return json.data;
    },
    async setOrderStatus(id, status){
      const token = localStorage.getItem(LS_TOKEN);
      const resp = await fetch(`/api/admin/orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ status })
      });
      const json = await resp.json();
      if (!resp.ok || !json?.sucesso) throw new Error(json?.mensagem || 'Falha ao atualizar status');
      return true;
    }
  };

  function formatBRL(value){
    try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value)||0); }
    catch(_) { return `R$ ${(Number(value)||0).toFixed(2)}`; }
  }

  const NotificationsManager = {
    container: null,
    _notified: new Set(),
    _pollTimer: null,
    _hasInitialSnapshot: false,
    init(){
      // Lazy container binding
      this.container = document.getElementById('orderNotificationContainer') || this.container;
      // Delegate close
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('.notif__close');
        if (!btn) return;
        const el = btn.closest('.order-notification');
        if (el) this.remove(el);
      });
      // Start fallback polling to ensure reliability even if WS falhar
      this.startPolling();
    },

    async handleOrderCreated(payload){
      try {
        const id = String(payload?.id || '');
        if (!id) return;
        let detail=null;
        try { detail = await API.getOrderDetail(id); } catch(_) {}
        const order = {
          id,
          value: Number(detail?.totals?.total ?? detail?.total ?? payload.total) || 0,
          time: new Date(detail?.data || payload?.created_at || Date.now()),
          customer: {
            name: detail?.cliente || payload?.customer?.name || 'Cliente',
            phone: detail?.telefone || payload?.customer?.phone || '',
            address: detail?.formattedAddress || payload?.customer?.address || ''
          }
        };
        // Dedup por ID
        if (!this._notified.has(order.id)) {
          this._notified.add(order.id);
          this.show(order);
        }
      } catch(_) {}
    },

    async acceptOrder(orderId){
      try {
        await API.setOrderStatus(orderId, 'preparando');
        if (window.showNotification) window.showNotification(`Pedido #${orderId} aceito e movido para preparação!`, 'success');
        try { if (window.loadDataFromAPI) window.loadDataFromAPI(); } catch(_){}
      } catch(e){
        if (window.showNotification) window.showNotification(e.message || 'Erro ao aceitar pedido', 'error');
      }
    },

    viewOrder(orderId){
      try { if (window.showSection) window.showSection('pedidos'); } catch(_){}
    },

    show(order){
      // Bind container se ainda não definido
      if (!this.container) this.container = document.getElementById('orderNotificationContainer');
      if (!this.container) return;
      try { if (window.notificationSound?.play) window.notificationSound.play(); } catch(_){}

      const tmpl = document.getElementById('orderNotificationTemplate');
      if (!tmpl || !('content' in tmpl)) return;
      const node = tmpl.content.cloneNode(true);
      const wrap = node.querySelector('.order-notification');
      const notif = node.querySelector('.notif');
      const idAttr = `notification-${Date.now()}`;
      if (wrap) { wrap.id = idAttr; wrap.dataset.id = String(order.id); }

      // Populate
      const idEl = node.querySelector('.notif__id');
      const timeEl = node.querySelector('.notif__time');
      const valueEl = node.querySelector('.notif__value');
      const nameEl = node.querySelector('.notif__name');
      const phoneEl = node.querySelector('.notif__phone');
      const addressEl = node.querySelector('.notif__address');

      if (idEl) idEl.textContent = `#${order.id}`;
      if (timeEl) {
        const timeString = order.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        timeEl.textContent = timeString;
        try { timeEl.setAttribute('datetime', order.time.toISOString()); } catch(_) {}
      }
      if (valueEl) valueEl.textContent = formatBRL(order.value);
      if (nameEl) nameEl.textContent = order.customer.name || 'Cliente';
      if (phoneEl) {
        const phone = order.customer.phone || '';
        phoneEl.textContent = phone;
        phoneEl.style.display = phone ? '' : 'none';
      }
      if (addressEl) {
        const addr = order.customer.address || '';
        addressEl.textContent = addr;
        addressEl.title = addr;
      }

      // Actions
      const onClick = (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const act = btn.getAttribute('data-action');
        const oid = String(order.id);
        if (act === 'view') this.viewOrder(oid);
        if (act === 'accept') {
          const card = btn.closest('.order-notification');
          if (card) this.remove(card); // close immediately
          this.acceptOrder(oid);
        }
      };
      if (notif) notif.addEventListener('click', onClick);

      // Insert and animate
      this.container.appendChild(node);
      const mounted = document.getElementById(idAttr);
      if (mounted) requestAnimationFrame(() => { mounted.classList.add('show'); });

      // Auto remove after 12s (optional)
      setTimeout(() => { const el = document.getElementById(idAttr); if (el) this.remove(el); }, 12000);

      // Limit to 3 visible
      const list = Array.from(this.container.querySelectorAll('.order-notification'));
      if (list.length > 3) {
        const oldest = list[0];
        this.remove(oldest);
      }
    },

    remove(id){
      const el = typeof id === 'string' ? document.getElementById(id) : id;
      if (!el) return;
      el.classList.add('hide');
      setTimeout(() => { el.remove(); }, 180);
    },

    startPolling(intervalMs = 12000){
      if (this._pollTimer) return;
      const tick = async () => {
        try {
          const token = localStorage.getItem(LS_TOKEN);
          if (!token) return;
          const resp = await fetch('/api/admin/orders', { headers: { 'Authorization': `Bearer ${token}` } });
          const json = await resp.json().catch(()=>null);
          if (!resp.ok || !json?.sucesso) return;
          const list = Array.isArray(json.data) ? json.data : [];
          if (!this._hasInitialSnapshot) {
            // Primeira rodada: não notificar histórico; apenas marcar IDs existentes
            list.forEach(o => this._notified.add(String(o.id)));
            this._hasInitialSnapshot = true;
            return;
          }
          // Novos pendentes ainda não notificados
          list.filter(o => String(o.status) === 'pendente')
              .sort((a,b)=> new Date(a.data) - new Date(b.data))
              .forEach(o => {
                const oid = String(o.id);
                if (this._notified.has(oid)) return;
                this._notified.add(oid);
                const order = {
                  id: oid,
                  value: Number(o.total)||0,
                  time: new Date(o.data || Date.now()),
                  customer: {
                    name: o.cliente || 'Cliente',
                    phone: o.telefone || '',
                    address: o.endereco || ''
                  }
                };
                this.show(order);
              });
        } catch(_) { /* noop */ }
      };
      // Rodar imediatamente a primeira vez (inicial marca snapshot)
      tick();
      this._pollTimer = setInterval(tick, intervalMs);
    },

    stopPolling(){
      if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    }
  };

  window.notifications = NotificationsManager;
})();
