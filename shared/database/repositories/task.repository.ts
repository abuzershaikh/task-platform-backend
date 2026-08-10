import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { TaskStatus } from '../../../task-engine/types/task-status.enum';

@Injectable()
export class TaskRepository {
    constructor(
        @InjectRepository(Task)
        private readonly repository: Repository<Task>,
    ) { }

    async findById(id: string): Promise<Task | null> {
        return this.repository.findOne({ where: { id } });
    }

    async findByStatus(status: string): Promise<Task[]> {
        return this.repository.find({ where: { status } });
    }

    async findByWorker(workerId: string): Promise<Task[]> {
        return this.repository.find({ where: { assignedTo: workerId } });
    }

    async findAvailableForAssignment(): Promise<Task[]> {
        return this.repository.find({
            where: { status: TaskStatus.ACTIVE, assignedTo: null },
        });
    }

    async findByWorkerAndStatus(workerId: string, status: string): Promise<Task[]> {
        return this.repository.find({
            where: { assignedTo: workerId, status },
        });
    }

    async create(data: Partial<Task>): Promise<Task> {
        const task = this.repository.create(data);
        return this.repository.save(task);
    }

    async update(id: string, data: Partial<Task>): Promise<Task> {
        await this.repository.update(id, data);
        return this.findById(id);
    }

    async delete(id: string): Promise<void> {
        await this.repository.delete(id);
    }

    async countByStatus(status: string): Promise<number> {
        return this.repository.count({ where: { status } });
    }

    async findByOrderId(orderId: string): Promise<Task[]> {
        return this.repository.find({ where: { orderId } });
    }
}
