import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';

export const GetTenantId = createParamDecorator(
  (data: { required?: boolean } = { required: true }, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // 1. Try to extract from Keycloak JWT token (if authenticated)
    const user = request.user;
    let tenantId = user?.tenantId || user?.tenant_id || user?.realm_access?.tenantId;

    // 2. Fallback to 'x-tenant-id' header or 'tenantId' query param for testing
    if (!tenantId) {
      tenantId = request.headers['x-tenant-id'] || request.query['tenantId'];
    }

    if (data?.required && !tenantId) {
      throw new BadRequestException(
        'Tenant context not found. JWT token, x-tenant-id header, or tenantId query parameter is required.',
      );
    }

    return tenantId;
  },
);
