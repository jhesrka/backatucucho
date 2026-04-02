import { FinancialService } from './src/presentation/services/financial/financial.service';

const service = new FinancialService();
console.log(service.getShopReconciliation);
console.log(service.getUnifiedTransactions);
