import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('service_catalog')
export class ServiceCatalog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100, unique: true })
    code: string;

    @Column({ type: 'varchar', length: 150 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ name: 'buyer_unit_price', type: 'decimal', precision: 10, scale: 2 })
    buyerUnitPrice: number;

    @Column({ name: 'worker_reward', type: 'decimal', precision: 10, scale: 2 })
    workerReward: number;

    @Column({ name: 'platform_margin', type: 'decimal', precision: 10, scale: 2 })
    platformMargin: number;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;

    @Column({ type: 'int', default: 1 })
    version: number;

    @Column({ name: 'pricing_history', type: 'json', nullable: true })
    pricingHistory: any[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
