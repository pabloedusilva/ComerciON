/**
 * Store Status Manager - Frontend
 * Sincroniza status da loja entre admin.html e menu.html via localStorage
 */

class StoreStatusManager {
    constructor() {
        this.statusKey = 'pizzaria_status';
        this.checkInterval = 5000; // Verifica a cada 5 segundos
        this.isStoreClosed = false;
        this.nextOpenTime = null;
        
        this.init();
    }

    init() {
        this.checkStoreStatus();
        this.startStatusMonitoring();
        
        // Verificar imediatamente ao carregar
        document.addEventListener('DOMContentLoaded', () => {
            this.checkStoreStatus();
        });
    }

    // Verificar status da loja no banco de dados
    async checkStoreStatus() {
        try {
            // Tentar buscar do API público primeiro
            const response = await fetch('/api/public/store');
            
            if (!response.ok) {
                // Se falhar, tentar localStorage como fallback
                this.checkStoreStatusFromStorage();
                return;
            }

            const result = await response.json();
            if (!result.sucesso || !result.data) {
                this.checkStoreStatusFromStorage();
                return;
            }

            const { closedNow, reopenAt, hours, isManualMode } = result.data;
            const now = new Date();
            
            let effectiveClosed = false;
            
            if (isManualMode) {
                // Modo manual: usar valor do closedNow diretamente
                effectiveClosed = closedNow;
                this.nextOpenTime = reopenAt ? new Date(reopenAt) : null;
            } else {
                // Modo automático: verificar horários de funcionamento
                effectiveClosed = this.isClosedBySchedule(now, hours);
                this.nextOpenTime = effectiveClosed ? this.getNextOpenTime(now, hours) : null;
            }
            
            this.isStoreClosed = effectiveClosed;
            this.updateStoreDisplay(effectiveClosed);

        } catch (error) {
            console.warn('Erro ao verificar status da loja na API:', error);
            // Fallback para localStorage
            this.checkStoreStatusFromStorage();
        }
    }

    // Fallback para localStorage (compatibilidade)
    checkStoreStatusFromStorage() {
        try {
            const statusData = localStorage.getItem(this.statusKey);
            
            if (!statusData) {
                // Se não há dados, assumir que está aberta
                this.updateStoreDisplay(false);
                return;
            }

            const status = JSON.parse(statusData);
            const now = new Date();
            
            // Verificar se está fechada manualmente
            if (status.closedNow) {
                this.isStoreClosed = true;
                this.nextOpenTime = status.reopenAt ? new Date(status.reopenAt) : null;
                this.updateStoreDisplay(true);
                return;
            }

            // Verificar horários de funcionamento
            if (status.hours && this.isClosedBySchedule(now, status.hours)) {
                this.isStoreClosed = true;
                this.nextOpenTime = this.getNextOpenTime(now, status.hours);
                this.updateStoreDisplay(true);
                return;
            }

            // Loja aberta
            this.isStoreClosed = false;
            this.nextOpenTime = null;
            this.updateStoreDisplay(false);

        } catch (error) {
            console.warn('Erro ao verificar status da loja no localStorage:', error);
            // Em caso de erro, assumir que está aberta
            this.updateStoreDisplay(false);
        }
    }

    // Verificar se está fechada por horário
    isClosedBySchedule(now, hours) {
        const currentDay = now.getDay(); // 0 = Domingo, 1 = Segunda...
        const currentTime = now.getHours() * 60 + now.getMinutes();

        const todayHours = hours.find(h => h.day === currentDay);
        
        if (!todayHours || !todayHours.enabled) {
            return true; // Fechado se não há horário definido
        }

        const openTime = this.timeToMinutes(todayHours.open);
        const closeTime = this.timeToMinutes(todayHours.close);

        if (openTime === closeTime) {
            return true; // Fechado se horário de abertura = fechamento
        }

        // Verifica se funciona durante a madrugada (ex: 22:00 às 02:00)
        if (closeTime < openTime) {
            return !(currentTime >= openTime || currentTime < closeTime);
        }

        // Horário normal (ex: 10:00 às 22:00)
        return !(currentTime >= openTime && currentTime < closeTime);
    }

    // Converter horário "HH:MM" para minutos
    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // Calcular próximo horário de abertura
    getNextOpenTime(now, hours) {
        const daysOrder = [0, 1, 2, 3, 4, 5, 6]; // Dom a Sáb
        let currentDay = now.getDay();
        
        // Verificar hoje primeiro
        for (let i = 0; i < 7; i++) {
            const checkDay = (currentDay + i) % 7;
            const dayHours = hours.find(h => h.day === checkDay && h.enabled);
            
            if (dayHours) {
                const openTime = this.timeToMinutes(dayHours.open);
                const currentTime = now.getHours() * 60 + now.getMinutes();
                
                // Se é hoje e ainda não passou do horário de abertura
                if (i === 0 && currentTime < openTime) {
                    const nextOpen = new Date(now);
                    const openHour = Math.floor(openTime / 60);
                    const openMinute = openTime % 60;
                    nextOpen.setHours(openHour, openMinute, 0, 0);
                    return nextOpen;
                }
                
                // Se é outro dia
                if (i > 0) {
                    const nextOpen = new Date(now);
                    nextOpen.setDate(nextOpen.getDate() + i);
                    const openHour = Math.floor(openTime / 60);
                    const openMinute = openTime % 60;
                    nextOpen.setHours(openHour, openMinute, 0, 0);
                    return nextOpen;
                }
            }
        }
        
        return null; // Sem horário de funcionamento encontrado
    }

    // Atualizar display da loja
    updateStoreDisplay(isClosed) {
        const carousel = document.querySelector('.hero-carousel');
        
        if (!carousel) return;

        if (isClosed) {
            this.showClosedOverlay(carousel);
        } else {
            this.hideClosedOverlay(carousel);
        }
    }

    // Mostrar overlay de loja fechada
    showClosedOverlay(carousel) {
        // Remover overlay existente se houver
        this.hideClosedOverlay(carousel);

        // Criar overlay
        const overlay = document.createElement('div');
        overlay.className = 'store-closed-overlay';
        
        // Texto principal
        const closedText = document.createElement('div');
        closedText.className = 'closed-text';
        closedText.textContent = 'Estamos Fechados';
        
        // Texto do horário
        const scheduleText = document.createElement('div');
        scheduleText.className = 'schedule-text';
        
        if (this.nextOpenTime) {
            const openText = this.formatNextOpenTime(this.nextOpenTime);
            scheduleText.textContent = openText;
        } else {
            scheduleText.textContent = 'Abrimos em breve';
        }

        overlay.appendChild(closedText);
        overlay.appendChild(scheduleText);
        
        carousel.appendChild(overlay);
        carousel.classList.add('store-closed');
    }

    // Esconder overlay de loja fechada
    hideClosedOverlay(carousel) {
        const overlay = carousel.querySelector('.store-closed-overlay');
        if (overlay) {
            overlay.remove();
        }
        carousel.classList.remove('store-closed');
    }

    // Formatar próximo horário de abertura
    formatNextOpenTime(nextOpen) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const openDay = new Date(nextOpen.getFullYear(), nextOpen.getMonth(), nextOpen.getDate());
        
        const dayDiff = Math.floor((openDay - today) / (1000 * 60 * 60 * 24));
        const timeStr = nextOpen.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        if (dayDiff === 0) {
            return `Abrimos hoje às ${timeStr}`;
        } else if (dayDiff === 1) {
            return `Abrimos amanhã às ${timeStr}`;
        } else {
            const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            const dayName = dayNames[nextOpen.getDay()];
            return `Abrimos ${dayName} às ${timeStr}`;
        }
    }

    // Iniciar monitoramento contínuo
    startStatusMonitoring() {
        setInterval(() => {
            this.checkStoreStatus();
        }, this.checkInterval);

        // Também verificar quando a aba ganha foco
        window.addEventListener('focus', () => {
            this.checkStoreStatus();
        });

        // Escutar mudanças no localStorage (mantido para compatibilidade)
        window.addEventListener('storage', (e) => {
            if (e.key === this.statusKey) {
                this.checkStoreStatus();
            }
        });
    }
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.storeStatusManager = new StoreStatusManager();
    });
} else {
    window.storeStatusManager = new StoreStatusManager();
}