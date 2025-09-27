// Validação simples da API usando http nativo
const http = require('http');

function testAPI() {
    return new Promise((resolve, reject) => {
        const req = http.get('http://localhost:3000/api/public/store', (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log('✅ API Response:');
                    console.log(JSON.stringify(result, null, 2));
                    
                    if (result.sucesso && result.data) {
                        console.log('\n🔍 Campo isManualMode presente:', 'isManualMode' in result.data);
                        console.log('   Valor:', result.data.isManualMode);
                    }
                    
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
}

async function main() {
    try {
        console.log('🔍 Testando API sem dependências externas...\n');
        await testAPI();
        console.log('\n✅ Teste concluído com sucesso!');
    } catch (error) {
        console.error('\n❌ Erro:', error.message);
        console.log('\nCertifique-se de que o servidor está rodando em http://localhost:3000');
    }
}

main();