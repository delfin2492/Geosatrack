export class RegisterTenantDto {
  companyName: string;
  adminName: string;
  adminEmail: string;
  password?: string;
  agentLimit?: number;
  assetLimit?: number;
}
