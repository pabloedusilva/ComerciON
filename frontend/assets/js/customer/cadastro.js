// Cadastro.js - Validações e funcionalidades do formulário de cadastro

document.addEventListener('DOMContentLoaded', function() {
    // Verificar se já está logado
    if (window.AuthSystem && window.AuthSystem.isAuthenticated()) {
        window.location.href = '/';
        return;
    }
    
    initializeRegisterForm();
});

function initializeRegisterForm() {
    setupPasswordToggles();
    setupPhoneMask();
    setupFormValidation();
    setupRealTimeValidation();
}

// Configurar botões de mostrar/ocultar senha
function setupPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.toggle-password');
    
    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = this.querySelector('i');
            
            const isPassword = input.getAttribute('type') === 'password';
            input.setAttribute('type', isPassword ? 'text' : 'password');
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
        });
    });
}

// Máscara para telefone
function setupPhoneMask() {
    const phoneInput = document.getElementById('phone');
    
    phoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.length <= 11) {
            if (value.length <= 2) {
                value = value.replace(/(\d{0,2})/, '($1');
            } else if (value.length <= 6) {
                value = value.replace(/(\d{2})(\d{0,4})/, '($1) $2');
            } else if (value.length <= 10) {
                value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
            } else {
                value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
            }
        }
        
        e.target.value = value;
    });
}

// Validação em tempo real
function setupRealTimeValidation() {
    const form = document.getElementById('registerForm');
    const inputs = form.querySelectorAll('input[required]');
    
    inputs.forEach(input => {
        // Validação ao sair do campo
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        // Limpar erro ao digitar
        input.addEventListener('input', function() {
            clearFieldError(this);
            
            // Validação especial para confirmação de senha
            if (this.id === 'confirmPassword' || this.id === 'password') {
                validatePasswordMatch();
            }
        });
    });
    
    // Validação para checkbox de termos
    const acceptTerms = document.getElementById('acceptTerms');
    acceptTerms.addEventListener('change', function() {
        validateField(this);
    });
}

// Validação principal do formulário
function setupFormValidation() {
    const form = document.getElementById('registerForm');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (validateForm()) {
            submitForm();
        }
    });
}

// Validar campo individual
function validateField(field) {
    const fieldId = field.id;
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';
    
    switch (fieldId) {
        case 'firstName':
            if (!value) {
                errorMessage = 'Nome é obrigatório.';
                isValid = false;
            } else if (value.length < 2) {
                errorMessage = 'Nome deve ter pelo menos 2 caracteres.';
                isValid = false;
            } else if (!/^[a-zA-ZàáâãéêíóôõúçÀÁÂÃÉÊÍÓÔÕÚÇ\s]+$/.test(value)) {
                errorMessage = 'Nome deve conter apenas letras.';
                isValid = false;
            }
            break;
            
        case 'lastName':
            if (!value) {
                errorMessage = 'Sobrenome é obrigatório.';
                isValid = false;
            } else if (value.length < 2) {
                errorMessage = 'Sobrenome deve ter pelo menos 2 caracteres.';
                isValid = false;
            } else if (!/^[a-zA-ZàáâãéêíóôõúçÀÁÂÃÉÊÍÓÔÕÚÇ\s]+$/.test(value)) {
                errorMessage = 'Sobrenome deve conter apenas letras.';
                isValid = false;
            }
            break;
            
        case 'email':
            if (!value) {
                errorMessage = 'E-mail é obrigatório.';
                isValid = false;
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                errorMessage = 'Informe um e-mail válido.';
                isValid = false;
            }
            break;
            
        case 'phone':
            const cleanPhone = value.replace(/\D/g, '');
            if (!value) {
                errorMessage = 'Telefone é obrigatório.';
                isValid = false;
            } else if (cleanPhone.length < 10 || cleanPhone.length > 11) {
                errorMessage = 'Informe um telefone válido.';
                isValid = false;
            }
            break;
            
        case 'password':
            if (!value) {
                errorMessage = 'Senha é obrigatória.';
                isValid = false;
            } else if (value.length < 6) {
                errorMessage = 'Senha deve ter pelo menos 6 caracteres.';
                isValid = false;
            } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
                errorMessage = 'Senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número.';
                isValid = false;
            }
            break;
            
        case 'confirmPassword':
            const password = document.getElementById('password').value;
            if (!value) {
                errorMessage = 'Confirmação de senha é obrigatória.';
                isValid = false;
            } else if (value !== password) {
                errorMessage = 'Senhas não coincidem.';
                isValid = false;
            }
            break;
            
        case 'acceptTerms':
            if (!field.checked) {
                errorMessage = 'Você deve aceitar os termos de uso.';
                isValid = false;
            }
            break;
    }
    
    showFieldError(field, errorMessage, !isValid);
    return isValid;
}

// Validar correspondência de senhas
function validatePasswordMatch() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (confirmPassword && password !== confirmPassword) {
        showFieldError(document.getElementById('confirmPassword'), 'Senhas não coincidem.', true);
        return false;
    } else if (confirmPassword && password === confirmPassword) {
        showFieldError(document.getElementById('confirmPassword'), '', false);
        return true;
    }
    
    return true;
}

// Validar formulário completo
function validateForm() {
    const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'password', 'confirmPassword', 'acceptTerms'];
    let isFormValid = true;
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!validateField(field)) {
            isFormValid = false;
        }
    });
    
    return isFormValid;
}

// Mostrar erro no campo
function showFieldError(field, message, hasError) {
    const errorElement = document.getElementById(field.id + 'Error');
    const inputWrapper = field.closest('.input-wrapper') || field.closest('.checkbox-group');
    
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = hasError ? 'block' : 'none';
    }
    
    if (inputWrapper) {
        if (hasError) {
            inputWrapper.classList.add('error');
        } else {
            inputWrapper.classList.remove('error');
        }
    }
    
    // Para campos normais
    if (field.closest('.input-wrapper')) {
        if (hasError) {
            field.style.borderColor = '#ef4444';
        } else {
            field.style.borderColor = '';
        }
    }
}

// Limpar erro do campo
function clearFieldError(field) {
    const errorElement = document.getElementById(field.id + 'Error');
    const inputWrapper = field.closest('.input-wrapper') || field.closest('.checkbox-group');
    
    if (errorElement) {
        errorElement.style.display = 'none';
    }
    
    if (inputWrapper) {
        inputWrapper.classList.remove('error');
    }
    
    field.style.borderColor = '';
}

// Submeter formulário
function submitForm() {
    const submitButton = document.querySelector('.auth-submit');
    const originalText = submitButton.textContent;
    
    // Estado de carregamento
    submitButton.classList.add('loading');
    submitButton.textContent = 'Criando conta...';
    submitButton.disabled = true;
    
    // Simular processo de cadastro
    setTimeout(() => {
        // Coletar dados do formulário
        const formData = {
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            password: document.getElementById('password').value,
            newsletter: document.getElementById('newsletter').checked
        };
        
        // Aqui você enviaria os dados para o backend
        console.log('Dados do cadastro:', formData);
        
        // Simular sucesso
        showSuccessMessage();
        
        // Redirecionar após sucesso
        setTimeout(() => {
            window.location.href = '/login?registered=true';
        }, 2000);
        
    }, 1500);
}

// Mostrar mensagem de sucesso
function showSuccessMessage() {
    const submitButton = document.querySelector('.auth-submit');
    
    submitButton.classList.remove('loading');
    submitButton.classList.add('success');
    submitButton.textContent = '✓ Conta criada com sucesso!';
    
    // Feedback visual adicional
    const authCard = document.querySelector('.auth-card');
    authCard.style.borderColor = '#10b981';
    authCard.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.1)';
}

// Utilitários para melhorar UX
function addLoadingState(element, loadingText) {
    element.classList.add('loading');
    element.textContent = loadingText;
    element.disabled = true;
}

function removeLoadingState(element, originalText) {
    element.classList.remove('loading');
    element.textContent = originalText;
    element.disabled = false;
}

// Validação de força da senha (funcionalidade extra)
function checkPasswordStrength(password) {
    let strength = 0;
    const checks = {
        length: password.length >= 8,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        numbers: /\d/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    Object.values(checks).forEach(check => {
        if (check) strength++;
    });
    
    return {
        score: strength,
        checks: checks,
        level: strength < 3 ? 'fraca' : strength < 4 ? 'média' : 'forte'
    };
}