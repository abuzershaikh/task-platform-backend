import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WorkerRepository } from '../../../../shared/database/repositories/worker.repository';
import { WorkerScoreRepository } from '../../../../shared/database/repositories/worker-score.repository';
import { UserRepository } from '../../../../shared/database/repositories/user.repository';
import { EarningRepository } from '../../../../shared/database/repositories/earning.repository';
import { Roles } from '../../../../shared/auth/decorators/roles.decorator';
import { UserRole, UserStatus } from '../../../../shared/database/entities/user.entity';

@ApiTags('Admin - Worker Management')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth('bearer')
@Controller('admin/workers')
export class AdminWorkerManagementController {
    constructor(
        private readonly workerRepo: WorkerRepository,
        private readonly scoreRepo: WorkerScoreRepository,
        private readonly userRepo: UserRepository,
        private readonly earningRepo: EarningRepository,
    ) { }

    @Get()
    @ApiOperation({ summary: 'List all workers' })
    async listWorkers() {
        const workers = await this.workerRepo.findActiveWorkers();
        return {
            success: true,
            workers,
            total: workers.length,
        };
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get worker details' })
    async getWorkerDetail(@Param('id') workerId: string) {
        const worker = await this.workerRepo.findById(workerId);
        if (!worker) {
            throw new NotFoundException('Worker not found');
        }

        const user = await this.userRepo.findById(worker.userId);
        const score = await this.scoreRepo.findByWorker(workerId);
        const earnings = await this.earningRepo.findByWorker(worker.userId);

        return {
            success: true,
            worker,
            user,
            score,
            totalEarningsRecorded: earnings.reduce((a, b) => a + Number(b.amount || 0), 0),
        };
    }

    @Get(':id/score')
    @ApiOperation({ summary: 'Get worker score breakdown' })
    async getWorkerScore(@Param('id') workerId: string) {
        const score = await this.scoreRepo.findByWorker(workerId);
        return {
            success: true,
            score: score || null,
        };
    }

    @Post(':id/status')
    @ApiOperation({ summary: 'Update worker account status' })
    async updateWorkerStatus(
        @Param('id') workerId: string,
        @Body() body: { status: string },
    ) {
        const worker = await this.workerRepo.findById(workerId);
        if (!worker) {
            throw new NotFoundException('Worker not found');
        }

        await this.workerRepo.update(workerId, { status: body.status });

        if (worker.userId && ['ACTIVE', 'SUSPENDED', 'BANNED'].includes(body.status.toUpperCase())) {
            await this.userRepo.updateStatus(worker.userId, body.status.toUpperCase() as UserStatus);
        }

        return {
            success: true,
            message: `Worker status updated to ${body.status}`,
        };
    }

    @Post(':id/withdrawal-limit')
    @ApiOperation({ summary: 'Set custom minimum withdrawal limit for specific worker' })
    async setWorkerWithdrawalLimit(
        @Param('id') workerId: string,
        @Body() body: { minWithdrawalLimit: number },
    ) {
        if (typeof body.minWithdrawalLimit !== 'number' || body.minWithdrawalLimit < 0) {
            throw new BadRequestException('minWithdrawalLimit must be a positive number');
        }

        const worker = await this.workerRepo.findById(workerId);
        if (!worker) {
            throw new NotFoundException('Worker not found');
        }

        const updatedProfile = {
            ...(worker.profile || {}),
            minWithdrawalLimit: body.minWithdrawalLimit,
        };

        const updated = await this.workerRepo.update(workerId, { profile: updatedProfile });

        return {
            success: true,
            worker: updated,
            message: `Minimum withdrawal limit for worker ${workerId} updated to ₹${body.minWithdrawalLimit}`,
        };
    }
}
