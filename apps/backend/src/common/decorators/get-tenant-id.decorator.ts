import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';

export const GetTenantId = createParamDecorator(
  (data: { required?: boolean } = { required: true }, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    
    // For now, extract from 'x-tenant-id' header or 'tenantId' query param.
    // Later, this will be extracted from Keycloak JWT payload (request.user.tenantId)
    const tenantId = request.headers['x-tenant-id'] || request.query['tenantId'];

    if (data?.required && !tenantId) {
      throw new BadRequestException('Header "x-tenant-id" or query parameter "tenantId" is required.');
    }

    return tenantId;
  },
);
