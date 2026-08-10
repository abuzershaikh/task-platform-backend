import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Body,
    NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ServiceCatalogRepository } from '../../../../shared/database/repositories/service-catalog.repository';
import { PricingEngineService } from '../../../../shared/services/pricing-engine.service';
import { Roles } from '../../../../shared/auth/decorators/roles.decorator';
import { UserRole } from '../../../../shared/database/entities/user.entity';

@ApiTags('Admin - Service Catalog & Pricing')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth('bearer')
@Controller('admin/services')
export class AdminServiceCatalogController {
    constructor(
        private readonly serviceCatalogRepo: ServiceCatalogRepository,
        private readonly pricingEngine: PricingEngineService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'List all services in catalog with pricing and margins' })
    async listServices() {
        const services = await this.serviceCatalogRepo.findAll();
        return {
            success: true,
            services,
            total: services.length,
        };
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get service details' })
    async getService(@Param('id') id: string) {
        const service = await this.serviceCatalogRepo.findById(id);
        if (!service) {
            throw new NotFoundException('Service not found');
        }
        return {
            success: true,
            service,
        };
    }

    @Post()
    @ApiOperation({ summary: 'Create new service in catalog' })
    async createService(
        @Body()
        body: {
            code: string;
            name: string;
            description?: string;
            buyerUnitPrice: number;
            workerReward: number;
        },
    ) {
        const platformMargin = body.buyerUnitPrice - body.workerReward;

        const created = await this.serviceCatalogRepo.create({
            code: body.code.toUpperCase(),
            name: body.name,
            description: body.description,
            buyerUnitPrice: body.buyerUnitPrice,
            workerReward: body.workerReward,
            platformMargin,
            isActive: true,
            version: 1,
            pricingHistory: [],
        });

        return {
            success: true,
            service: created,
            message: 'Service catalog item created',
        };
    }

    @Patch(':id/pricing')
    @ApiOperation({ summary: 'Update service pricing (Buyer Unit Price & Worker Reward)' })
    async updatePricing(
        @Param('id') id: string,
        @Body() body: { buyerUnitPrice: number; workerReward: number },
    ) {
        const updated = await this.pricingEngine.updateServicePricing(id, body);
        return {
            success: true,
            service: updated,
            message: `Service pricing updated to Version ${updated.version}`,
        };
    }

    @Get(':id/history')
    @ApiOperation({ summary: 'Get service pricing version history' })
    async getHistory(@Param('id') id: string) {
        const service = await this.serviceCatalogRepo.findById(id);
        if (!service) {
            throw new NotFoundException('Service not found');
        }

        return {
            success: true,
            currentVersion: service.version,
            history: service.pricingHistory || [],
        };
    }
}
