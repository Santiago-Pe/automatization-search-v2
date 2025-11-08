import * as readline from 'readline';

export function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function getUserSelection(totalCompanies: number): Promise<number> {
  console.log(`\nOpciones disponibles:`);
  console.log(`  1. Procesar TODAS las ${totalCompanies} empresas`);
  console.log(`  2. Procesar las primeras 3 empresas (recomendado para testing)`);
  console.log(`  3. Procesar las primeras 5 empresas`);
  console.log(`  4. Especificar cantidad personalizada`);
  console.log(`  5. Cancelar`);
  
  while (true) {
    const choice = await askQuestion('\nElige una opción (1-5): ');
    
    switch (choice) {
      case '1':
        return totalCompanies;
      case '2':
        return Math.min(3, totalCompanies);
      case '3':
        return Math.min(5, totalCompanies);
      case '4':
        while (true) {
          const customAmount = await askQuestion(`¿Cuántas empresas quieres procesar? (máx ${totalCompanies}): `);
          const amount = parseInt(customAmount);
          if (!isNaN(amount) && amount > 0 && amount <= totalCompanies) {
            return amount;
          }
          console.log(`Por favor ingresa un número entre 1 y ${totalCompanies}`);
        }
      case '5':
        console.log('Proceso cancelado');
        process.exit(0);
      default:
        console.log('Opción inválida. Elige 1, 2, 3, 4 o 5.');
    }
  }
}

export async function confirmAction(message: string): Promise<boolean> {
  const answer = await askQuestion(`${message} (s/n): `);
  return answer.toLowerCase() === 's' || answer.toLowerCase() === 'si';
}
