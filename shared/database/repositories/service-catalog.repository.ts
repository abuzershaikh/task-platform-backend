import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceCatalog } from '../entities/service-catalog.entity';

@Injectable()
export class ServiceCatalogRepository {
    constructor(
        @InjectRepository(ServiceCatalog)
        private readonly repo: Repository<ServiceCatalog>,
    ) { }

    async findAll(): Promise<ServiceCatalog[]> {
        return this.repo.find({ order: { name: 'ASC' } });
    }

    async findActive(): Promise<ServiceCatalog[]> {
        return this.repo.find({ where: { isActive: true }, order: { name: 'ASC' } });
    }

    async findById(id: string): Promise<ServiceCatalog | null> {
        return this.repo.findOne({ where: { id } });
    }

    async findByCode(code: string): Promise<ServiceCatalog | null> {
        return this.repo.findOne({ where: { code } });
    }

    async create(data: Partial<ServiceCatalog>): Promise<ServiceCatalog> {
        const item = this.repo.create(data);
        return this.repo.save(item);
    }

    async update(id: string, data: Partial<ServiceCatalog>): Promise<ServiceCatalog | null> {
        await this.repo.update(id, data);
        return this.findById(id);
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.repo.delete(id);
        return (result.affected || 0) > 0;
    }
}
