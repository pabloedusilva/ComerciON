/**
 * PDF Generator Service - Serviço de Geração de Comprovantes Modernos
 * Gera PDFs extremamente profissionais e clean para comprovantes de pedidos
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class ModernPDFReceiptGenerator {
    constructor() {
        this.colors = {
            // Paleta ultra minimalista (tons de cinza)
            primary: '#111111',
            secondary: '#222222',
            accent: '#111111', // manter referência mas sem uso de cor vibrante
            success: '#111111',
            error: '#111111',
            warning: '#111111',
            // Texto
            text: {
                primary: '#111111',
                secondary: '#2a2a2a',
                muted: '#6b6b6b',
                light: '#9a9a9a'
            },
            // Backgrounds
            bg: {
                white: '#ffffff',
                gray: '#ffffff',
                light: '#ffffff',
                border: '#e5e5e5'
            }
        };
        
        this.fonts = {
            regular: 'Helvetica',
            bold: 'Helvetica-Bold',
            semibold: 'Helvetica-Bold', // Usando bold como semibold
            oblique: 'Helvetica-Oblique'
        };
    }

    /**
     * Formatar valores monetários
     */
    formatCurrency(value) {
        return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
    }

    /**
     * Formatar data
     */
    formatDate(date) {
        try {
            return new Date(date).toLocaleString('pt-BR');
        } catch (_) {
            return '—';
        }
    }

    /**
     * Obter label de tamanho
     */
    getSizeLabel(size, productName = '') {
        // Se o produto contém "única" no nome, não mostrar tamanho
        if (productName.toLowerCase().includes('única') || 
            productName.toLowerCase().includes('unica') ||
            productName.toLowerCase().includes('único') ||
            productName.toLowerCase().includes('unico')) {
            return '';
        }
        
        const sizeLabels = ['P', 'M', 'G'];
        const sizeIndex = Number(size);
        
        if (sizeIndex >= 0 && sizeIndex < sizeLabels.length) {
            return ` (${sizeLabels[sizeIndex]})`;
        }
        
        return '';
    }

    /**
     * Baixar e processar logo se for URL externa
     */
    async downloadLogo(logoUrl) {
        return new Promise((resolve) => {
            if (!logoUrl) return resolve(null);

            // URL externa (http/https)
            const normalized = String(logoUrl).replace(/\\/g, '/');

            if (/^https?:\/\//i.test(normalized)) {
                const client = normalized.startsWith('https') ? https : http;
                client.get(normalized, (response) => {
                    if (response.statusCode !== 200) return resolve(null);
                    const chunks = [];
                    response.on('data', (chunk) => chunks.push(chunk));
                    response.on('end', () => resolve(Buffer.concat(chunks)));
                }).on('error', () => resolve(null));
                return;
            }

            // Caminhos locais: resolver para backend/public quando vier como 
            // '/uploads/...', 'uploads/...', ou relativo
            try {
                const publicRoot = path.join(__dirname, '..', '..', 'public');
                const candidates = [];

                const sanitized = normalized.replace(/^\\+/g, '/');
                const noLeadingSlash = sanitized.replace(/^\/+/, '');

                // 1) Se for absoluto e existir, usar; se não existir, tentar remapear após '/uploads/'
                if (path.isAbsolute(sanitized)) {
                    if (fs.existsSync(sanitized)) {
                        return resolve(sanitized);
                    }
                    const idx = sanitized.toLowerCase().indexOf('/uploads/');
                    if (idx !== -1) {
                        const sub = sanitized.substring(idx + '/uploads/'.length);
                        const remapped = path.join(publicRoot, 'uploads', sub);
                        if (fs.existsSync(remapped)) {
                            return resolve(remapped);
                        }
                    }
                }

                // 2) Tentar em publicRoot com e sem 'uploads/'
                candidates.push(path.join(publicRoot, noLeadingSlash));
                if (!noLeadingSlash.startsWith('uploads')) {
                    candidates.push(path.join(publicRoot, 'uploads', noLeadingSlash));
                }

                // 3) Se o caminho começar com 'site/' (muito comum), prefixar uploads/site
                if (noLeadingSlash.startsWith('site/')) {
                    candidates.push(path.join(publicRoot, 'uploads', noLeadingSlash));
                }

                // 4) Caminho relativo ao CWD (fallback)
                candidates.push(path.resolve(process.cwd(), noLeadingSlash));

                for (const p of candidates) {
                    try {
                        if (fs.existsSync(p)) return resolve(p);
                    } catch (_) { /* ignore */ }
                }

                // Não encontrado
                return resolve(null);
            } catch (_) {
                return resolve(null);
            }
        });
    }

    /**
     * Desenhar header moderno com logo
     */
    async drawModernHeader(doc, storeSettings, layoutData) {
        const pageWidth = doc.page.width;
        const headerHeight = 110;

        // Fundo branco ultra clean
        doc.rect(0, 0, pageWidth, headerHeight).fill(this.colors.bg.white);

        // Linha divisória inferior
        doc.rect(0, headerHeight - 1, pageWidth, 1).fill(this.colors.bg.border);

        // Logo e título
        const padding = 40;
        const logoSize = 56;
        let x = padding;
        const y = 28;

        let hasLogo = false;
        if (layoutData?.logo_url) {
            try {
                const logoData = await this.downloadLogo(layoutData.logo_url);
                if (logoData) {
                    doc.image(logoData, x, y, { fit: [logoSize, logoSize] });
                    hasLogo = true;
                    x += logoSize + 16;
                }
            } catch (_) { /* silencioso para manter clean */ }
        }

        // Informações da empresa (texto preto, sem ícones)
        const textStartX = x;
        const textWidth = pageWidth - textStartX - padding;
        doc.fillColor(this.colors.text.primary)
           .fontSize(20)
           .font(this.fonts.bold)
           .text(storeSettings?.name || 'Estabelecimento', textStartX, y, { width: textWidth });

        let ty = y + 24;
        doc.fillColor(this.colors.text.muted).fontSize(10).font(this.fonts.regular);
        if (storeSettings?.address) { doc.text(storeSettings.address, textStartX, ty); ty += 14; }
        if (storeSettings?.phone)   { doc.text(storeSettings.phone,   textStartX, ty); ty += 14; }
        if (storeSettings?.email)   { doc.text(storeSettings.email,   textStartX, ty); }

        return headerHeight + 16;
    }

    /**
     * Desenhar seção de informações do pedido moderna
     */
     drawModernOrderInfo(doc, order, currentY) {
          const pageWidth = doc.page.width - 60;
          const cardHeight = 110;
          // Card minimalista
          doc.rect(30, currentY, pageWidth, cardHeight).stroke(this.colors.bg.border);

          // Título
          doc.fillColor(this.colors.text.primary).fontSize(14).font(this.fonts.bold).text('Informações do Pedido', 40, currentY + 15);

          const col1X = 40;
          const col2X = 220;
          const col3X = 400;
          const infoY = currentY + 45;

          // Coluna 1 - Pedido
          doc.fillColor(this.colors.text.muted).fontSize(9).font(this.fonts.regular).text('Pedido Nº', col1X, infoY);
          doc.fillColor(this.colors.text.primary).fontSize(16).font(this.fonts.bold).text(`#${order.id}`, col1X, infoY + 14);

          // Coluna 2 - Status (texto simples)
          doc.fillColor(this.colors.text.muted).fontSize(9).font(this.fonts.regular).text('Status', col2X, infoY);
    const statusInfo = this.getStatusInfoMinimal(order);
    const statusMap = { 'PAGO': 'APROVADO', 'CANCELADO': 'CANCELADO', 'PENDENTE': 'NÃO PAGO' };
    const statusText = statusMap[statusInfo.text] || statusInfo.text;
    doc.fillColor(this.colors.text.primary).fontSize(12).font(this.fonts.regular).text(statusText, col2X, infoY + 14);

          // Coluna 3 - Data
          doc.fillColor(this.colors.text.muted).fontSize(9).font(this.fonts.regular).text('Data e hora', col3X, infoY);
          doc.fillColor(this.colors.text.primary).fontSize(12).font(this.fonts.regular).text(this.formatDate(order.created_at), col3X, infoY + 14);

          // ID Transação (linha simples)
          if (order.payment?.txid) {
                const txY = currentY + cardHeight + 8;
                doc.rect(30, txY, pageWidth, 1).fill(this.colors.bg.border);
                doc.fillColor(this.colors.text.muted).fontSize(9).font(this.fonts.regular).text('ID da transação', 40, txY + 10);
                doc.fillColor(this.colors.text.primary).fontSize(11).font('Courier').text(String(order.payment.txid), 40, txY + 24);
                return txY + 50;
          }

          return currentY + cardHeight + 12;
     }

    /**
     * Obter informações de status formatadas
     */
    getStatusInfo(order) {
        const st = String(order.status || '').toLowerCase();
        const paidByStatus = st === 'pago' || st === 'aprovado' || st === 'approved';
        if ((order.payment && order.payment.txid) || paidByStatus) {
            return {
                text: 'PAGO',
                bgColor: 'rgba(16, 185, 129, 0.1)', // Success background
                borderColor: this.colors.success,
                textColor: this.colors.success
            };
        }
        
        if (order.status === 'cancelado' || order.status === 'falha_pagamento') {
            return {
                text: 'CANCELADO',
                bgColor: 'rgba(239, 68, 68, 0.1)', // Error background
                borderColor: this.colors.error,
                textColor: this.colors.error
            };
        }
        
        return {
            text: 'PENDENTE',
            bgColor: 'rgba(245, 158, 11, 0.1)', // Warning background
            borderColor: this.colors.warning,
            textColor: this.colors.warning
        };
    }

    // Versão minimalista: retorna apenas o texto
    getStatusInfoMinimal(order) {
        // Como o comprovante só é gerado se o pagamento foi processado, sempre retornar PAGO
        return { text: 'PAGO' };
    }

    /**
     * Desenhar ID da transação com destaque especial
     */
    drawTransactionId(doc, txid, currentY) {
        const pageWidth = doc.page.width - 60;
        
        // Card especial para transação
        doc.rect(30, currentY, pageWidth, 40)
           .fillAndStroke('#eff6ff', '#3b82f6'); // Blue background
           
        // Ícone e texto
        doc.fillColor(this.colors.accent)
           .fontSize(12)
           .font(this.fonts.bold)
           .text('🔒 ID DA TRANSAÇÃO', 50, currentY + 8);
           
        doc.fillColor(this.colors.text.primary)
           .fontSize(14)
           .font('Courier') // Fonte monospace para ID
           .text(txid, 50, currentY + 22);
    }

    /**
     * Desenhar itens do pedido com layout moderno
     */
    drawModernOrderItems(doc, items, currentY) {
        if (!items || items.length === 0) return currentY;
        const pageWidth = doc.page.width - 60;
        doc.fillColor(this.colors.text.primary).fontSize(14).font(this.fonts.bold).text('Itens do Pedido', 30, currentY);
        currentY += 20;

        // Cabeçalho das colunas
        const xName = 40, xQty = 420, xPrice = 500;
        doc.fillColor(this.colors.text.muted).fontSize(9).font(this.fonts.regular);
        doc.text('Item', xName, currentY).text('Qtd', xQty, currentY).text('Total', xPrice, currentY);
        currentY += 12;
        doc.rect(30, currentY, pageWidth, 1).fill(this.colors.bg.border); currentY += 6;

        // Linhas de itens
        items.forEach((item) => {
            const totalItem = Number(item.price || 0) * Number(item.quantity || 0);
            const name = String(item.product_name || item.name || 'Item');
            
            // Lógica corrigida para tamanhos: sempre usar size_name se disponível
            let sizeInfo = '';
            if (item.size_name && String(item.size_name).trim() !== '') {
                const sizeName = String(item.size_name).trim();
                if (sizeName !== 'Tamanho Único') {
                    // Se não for "Tamanho Único", mostrar entre parênteses
                    sizeInfo = ` (${sizeName})`;
                }
                // Se for "Tamanho Único", não mostrar nada (sizeInfo fica vazio)
            } else if (Number.isFinite(item.size)) {
                // Fallback para quando não há size_name
                const labels = ['P','M','G'];
                const idx = Number(item.size);
                if (idx >= 0 && idx < labels.length) {
                    sizeInfo = ` (${labels[idx]})`;
                }
            }

            doc.fillColor(this.colors.text.primary).fontSize(11).font(this.fonts.regular)
               .text(name + sizeInfo, xName, currentY, { width: xQty - xName - 10 });
            doc.text(`${item.quantity}x`, xQty, currentY);
            doc.text(this.formatCurrency(totalItem), xPrice, currentY);

            currentY += 16;
            doc.rect(30, currentY, pageWidth, 1).fill(this.colors.bg.border); currentY += 6;
        });

        return currentY + 4;
    }

    /**
     * Desenhar itens do pedido (método legado)
     */
    drawOrderItems(doc, items, currentY) {
        if (!items || items.length === 0) {
            return currentY;
        }

        const pageWidth = doc.page.width - 80;
        
        // Header da seção de itens
        doc.rect(40, currentY, pageWidth, 30)
           .fillAndStroke(this.colors.secondary, this.colors.secondary);

        doc.fillColor('#ffffff')
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('ITENS DO PEDIDO', 60, currentY + 10);

        currentY += 35;

        // Headers das colunas
        doc.rect(40, currentY, pageWidth, 20)
           .fillAndStroke(this.colors.background, this.colors.border);

        doc.fillColor(this.colors.text)
           .fontSize(9)
           .font('Helvetica-Bold')
           .text('ITEM', 60, currentY + 7)
           .text('QTD', 350, currentY + 7)
           .text('VALOR UNIT.', 400, currentY + 7)
           .text('TOTAL', 480, currentY + 7);

        currentY += 25;

        // Renderizar itens
        items.forEach((item, index) => {
            const isEven = index % 2 === 0;
            const bgColor = isEven ? '#ffffff' : this.colors.background;
            
            const itemHeight = 25;
            doc.rect(40, currentY, pageWidth, itemHeight)
               .fillAndStroke(bgColor, this.colors.border);

            const itemName = item.name || item.name_snapshot || 'Item';
            const sizeLabel = this.getSizeLabel(item.size, itemName);
            const fullName = `${itemName}${sizeLabel}`;
            
            const quantity = Number(item.quantity || 0);
            const unitPrice = Number(item.unit_price || 0);
            const totalPrice = unitPrice * quantity;

            doc.fillColor(this.colors.text)
               .fontSize(9)
               .font('Helvetica')
               .text(fullName, 60, currentY + 8, { width: 280 })
               .text(quantity.toString(), 350, currentY + 8)
               .text(this.formatCurrency(unitPrice), 400, currentY + 8)
               .font('Helvetica-Bold')
               .text(this.formatCurrency(totalPrice), 480, currentY + 8);

            currentY += itemHeight;
        });

        return currentY + 10;
    }

    /**
     * Desenhar resumo financeiro moderno
     */
    drawModernFinancialSummary(doc, order, currentY) {
        const pageWidth = doc.page.width - 60;
        doc.fillColor(this.colors.text.primary).fontSize(14).font(this.fonts.bold).text('Resumo Financeiro', 30, currentY);
        currentY += 16;
        doc.rect(30, currentY, pageWidth, 1).fill(this.colors.bg.border); currentY += 8;

        const leftCol = 40, rightCol = pageWidth - 20; // alinhamento à direita
        let y = currentY;

        this.drawSummaryLine(doc, 'Subtotal', this.formatCurrency(order.subtotal || 0), leftCol, rightCol, y); y += 16;
        if (order.delivery_fee && Number(order.delivery_fee) > 0) {
            this.drawSummaryLine(doc, 'Entrega', this.formatCurrency(order.delivery_fee), leftCol, rightCol, y); y += 16;
        }
        if (order.discount && Number(order.discount) > 0) {
            this.drawSummaryLine(doc, 'Desconto', `-${this.formatCurrency(order.discount)}`, leftCol, rightCol, y); y += 16;
        }
        doc.rect(30, y + 4, pageWidth, 1).fill(this.colors.bg.border); y += 12;
        const total = this.calculateTotal(order);
        this.drawSummaryLine(doc, 'TOTAL', this.formatCurrency(total), leftCol, rightCol, y, true);
        return y + 24;
    }

    /**
     * Desenhar linha do resumo financeiro
     */
     drawSummaryLine(doc, label, value, leftCol, rightCol, y, isBold = false) {
          doc.fillColor(isBold ? this.colors.text.primary : this.colors.text.muted)
              .fontSize(isBold ? 14 : 11)
              .font(isBold ? this.fonts.bold : this.fonts.regular)
              .text(label, leftCol, y);
          doc.fillColor(this.colors.text.primary)
              .fontSize(isBold ? 14 : 11)
              .font(isBold ? this.fonts.bold : this.fonts.regular)
              .text(value, rightCol, y, { align: 'right' });
     }

    /**
     * Calcular total do pedido
     */
    calculateTotal(order) {
        const subtotal = Number(order.subtotal || 0);
        const deliveryFee = Number(order.delivery_fee || 0);
        const discount = Number(order.discount || 0);
        
        return subtotal + deliveryFee - discount;
    }

    /**
     * Desenhar resumo financeiro (método legado)
     */
    drawFinancialSummary(doc, order, currentY) {
        const summaryWidth = 200;
        const summaryX = doc.page.width - summaryWidth - 40;

        // Card do resumo
        doc.rect(summaryX, currentY, summaryWidth, 100)
           .fillAndStroke(this.colors.background, this.colors.border);

        // Título
        doc.fillColor(this.colors.text)
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('RESUMO', summaryX + 20, currentY + 15);

        let summaryY = currentY + 35;

        doc.fillColor(this.colors.textLight)
           .fontSize(10)
           .font('Helvetica');

        // Subtotal
        doc.text('Subtotal:', summaryX + 20, summaryY)
           .fillColor(this.colors.text)
           .text(this.formatCurrency(order.subtotal), summaryX + 120, summaryY);

        // Taxa de entrega
        summaryY += 15;
        doc.fillColor(this.colors.textLight)
           .text('Entrega:', summaryX + 20, summaryY)
           .fillColor(this.colors.text)
           .text(this.formatCurrency(order.delivery_fee), summaryX + 120, summaryY);

        // Desconto (se houver)
        if (order.discount && Number(order.discount) > 0) {
            summaryY += 15;
            doc.fillColor(this.colors.textLight)
               .text('Desconto:', summaryX + 20, summaryY)
               .fillColor('#dc2626')
               .text(`-${this.formatCurrency(order.discount)}`, summaryX + 120, summaryY);
        }

        // Total
        summaryY += 20;
        doc.rect(summaryX + 15, summaryY - 3, summaryWidth - 30, 20)
           .fillAndStroke(this.colors.success, this.colors.success);

        doc.fillColor('#ffffff')
           .fontSize(11)
           .font('Helvetica-Bold')
           .text('TOTAL:', summaryX + 25, summaryY + 2)
           .text(this.formatCurrency(order.total), summaryX + 110, summaryY + 2);

        return currentY + 110;
    }

    /**
     * Desenhar footer
     */
    drawFooter(doc, currentY) {
        const footerY = Math.max(currentY + 30, doc.page.height - 60);
        
        doc.fillColor(this.colors.textMuted)
           .fontSize(9)
           .font('Helvetica')
           .text('Comprovante gerado automaticamente pelo sistema.', 40, footerY, {
               width: doc.page.width - 80,
               align: 'center'
           });

        doc.fontSize(8)
           .text(`Documento gerado em ${this.formatDate(new Date())}`, 40, footerY + 15, {
               width: doc.page.width - 80,
               align: 'center'
           });
    }

    /**
     * Gerar PDF moderno e profissional
     */
    async generateModernReceipt(orderData, storeSettings, layoutSettings, res, inline = false) {
        try {
            // Configurar resposta
            const filename = `comprovante_pedido_${orderData.id}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${filename}"`);
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');

            // Criar documento com configurações aprimoradas
            const doc = new PDFDocument({ 
                size: 'A4', 
                margin: 30,
                bufferPages: true,
                info: {
                    Title: `Comprovante - Pedido #${orderData.id}`,
                    Author: storeSettings?.name || 'Estabelecimento',
                    Subject: 'Comprovante de Pagamento Profissional',
                    Keywords: 'comprovante, pagamento, pedido, infinitepay'
                }
            });

            // Pipe para resposta
            doc.pipe(res);

            // Desenhar seções modernas
            let currentY = await this.drawModernHeader(doc, storeSettings, layoutSettings);
            currentY = this.drawModernOrderInfo(doc, orderData, currentY);
            currentY = this.drawModernOrderItems(doc, orderData.items, currentY);
            currentY = this.drawModernFinancialSummary(doc, orderData, currentY);
            this.drawModernFooter(doc, currentY, storeSettings, orderData);

            // Finalizar documento
            doc.end();

        } catch (error) {
            console.error('Erro na geração do PDF moderno:', error);
            if (!res.headersSent) {
                res.status(500).json({ 
                    sucesso: false, 
                    mensagem: 'Erro ao gerar comprovante moderno',
                    erro: error.message
                });
            }
        }
    }

    /**
     * Gerar PDF completo (método legado)
     */
    async generateReceipt(orderData, storeSettings, res, inline = false) {
        try {
            // Configurar resposta
            const filename = `comprovante_pedido_${orderData.id}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${filename}"`);
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');

            // Criar documento
            const doc = new PDFDocument({ 
                size: 'A4', 
                margin: 40,
                info: {
                    Title: `Comprovante - Pedido #${orderData.id}`,
                    Author: storeSettings?.name || 'Sistema de Pedidos',
                    Subject: 'Comprovante de Pagamento'
                }
            });

            // Pipe para resposta
            doc.pipe(res);

            // Desenhar seções
            let currentY = this.drawHeader(doc, storeSettings);
            currentY = this.drawOrderInfo(doc, orderData, currentY);
            currentY = this.drawOrderItems(doc, orderData.items, currentY);
            currentY = this.drawFinancialSummary(doc, orderData, currentY);
            this.drawFooter(doc, currentY);

            // Finalizar documento
            doc.end();

        } catch (error) {
            console.error('Erro na geração do PDF:', error);
            if (!res.headersSent) {
                res.status(500).json({ sucesso: false, mensagem: 'Erro ao gerar comprovante' });
            }
        }
    }

    /**
     * Desenhar footer moderno
     */
    drawModernFooter(doc, currentY, storeSettings, orderData) {
        const pageWidth = doc.page.width - 60;
        const footerY = doc.page.height - 90;
        const finalY = Math.max(currentY + 24, footerY);
        doc.rect(30, finalY, pageWidth, 1).fill(this.colors.bg.border);

        doc.fillColor(this.colors.text.muted).fontSize(9).font(this.fonts.regular);
        doc.text('Pagamento processado via InfinitePay', 40, finalY + 10);
        doc.text('Comprovante gerado com segurança', 40, finalY + 24);
        doc.fillColor(this.colors.text.light).fontSize(8).text(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`, 40, finalY + 38);
        if (orderData?.payment?.txid) {
            doc.fillColor(this.colors.text.muted).fontSize(9).font(this.fonts.regular)
               .text('ID da transação', pageWidth - 200, finalY + 10, { width: 200, align: 'right' });
            doc.fillColor(this.colors.text.primary).fontSize(9).font('Courier')
               .text(String(orderData.payment.txid), pageWidth - 200, finalY + 24, { width: 200, align: 'right' });
        }
        if (storeSettings?.phone) {
            doc.fillColor(this.colors.text.muted).fontSize(9).text(`Dúvidas? ${storeSettings.phone}`, pageWidth - 200, finalY + 10, { width: 200, align: 'right' });
        }
    }
}

module.exports = new ModernPDFReceiptGenerator();