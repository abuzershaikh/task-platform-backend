import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ServiceCatalogRepository } from '../database/repositories/service-catalog.repository';
import { ServiceCatalog } from '../database/entities/service-catalog.entity';

export interface PriceSnapshot {
    serviceCode: string;
    buyerUnitPrice: number;
    workerReward: number;
    platformMargin: number;
    totalTasksRequired: number;
    totalOrderAmount: number;
    pricingVersion: number;
}

@Injectable()
export class PricingEngineService {
    constructor(private readonly serviceCatalogRepo: ServiceCatalogRepository) { }

    async getServiceByCode(code: string): Promise<ServiceCatalog> {
        const service = await this.serviceCatalogRepo.findByCode(code);
        if (!service) {
            throw new NotFoundException(`Service with code '${code}' not found in catalog`);
        }
        return service;
    }

    async calculatePriceSnapshot(serviceCode: string, totalTasksRequired: number): Promise<PriceSnapshot> {
        if (totalTasksRequired <= 0) {
            throw new BadRequestException('totalTasksRequired must be greater than 0');
        }

        const service = await this.getServiceByCode(serviceCode);
        if (!service.isActive) {
            throw new BadRequestException(`Service '${service.name}' is currently inactive`);
        }

        const buyerUnitPrice = Number(service.buyerUnitPrice);
        const workerReward = Number(service.workerReward);
        const platformMargin = Number(service.platformMargin);
        const totalOrderAmount = buyerUnitPrice * totalTasksRequired;

        return {
            serviceCode: service.code,
            buyerUnitPrice,
            workerReward,
            platformMargin,
            totalTasksRequired,
            totalOrderAmount,
            pricingVersion: service.version,
        };
    }

    async updateServicePricing(
        serviceId: string,
        newPricing: { buyerUnitPrice: number; workerReward: number },
    ): Promise<ServiceCatalog> {
        const service = await this.serviceCatalogRepo.findById(serviceId);
        if (!service) {
            throw new NotFoundException('Service not found');
        }

        if (newPricing.buyerUnitPrice <= 0 || newPricing.workerReward <= 0) {
            throw new BadRequestException('Prices must be positive numbers');
        }

        if (newPricing.workerReward >= newPricing.buyerUnitPrice) {
            throw new BadRequestException('Worker reward must be less than buyer unit price');
        }

        const platformMargin = newPricing.buyerUnitPrice - newPricing.workerReward;
        const currentHistory = service.pricingHistory || [];

        const historyEntry = {
            version: service.version,
            buyerUnitPrice: service.buyerUnitPrice,
            workerReward: service.workerReward,
            platformMargin: service.platformMargin,
            updatedAt: new Date(),
        };

        const updated = await this.serviceCatalogRepo.update(serviceId, {
            buyerUnitPrice: newPricing.buyerUnitPrice,
            workerReward: newPricing.workerReward,
            platformMargin,
            version: service.version + 1,
            pricingHistory: [...currentHistory, historyEntry],
        });

        return updated!;
    }
}
