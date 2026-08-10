import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('orders')
export class Order {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'buyer_id' })
    buyerId: string;

    @Column({ type: 'varchar', length: 100 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ name: 'task_type' })
    taskType: string;

    @Column({ name: 'total_tasks_required', type: 'int' })
    totalTasksRequired: number;

    @Column({ name: 'tasks_completed', type: 'int', default: 0 })
    tasksCompleted: number;

    @Column({ name: 'reward_per_task', type: 'decimal', precision: 10, scale: 2 })
    rewardPerTask: number;

    @Column({ type: 'varchar', length: 50 })
    status: string;

    @Column({ type: 'json', nullable: true })
    requirements: any;

    @Column({ name: 'review_mode', type: 'varchar', length: 50 })
    reviewMode: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
