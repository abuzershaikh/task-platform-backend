import {
    Controller,
    Post,
    Param,
    Body,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RatingRepository } from '../../../../shared/database/repositories/rating.repository';
import { TaskRepository } from '../../../../shared/database/repositories/task.repository';
import { OrderRepository } from '../../../../shared/database/repositories/order.repository';
import { WorkerRepository } from '../../../../shared/database/repositories/worker.repository';
import { Roles } from '../../../../shared/auth/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/auth/decorators/current-user.decorator';
import { UserRole, User } from '../../../../shared/database/entities/user.entity';

@ApiTags('Buyer - Ratings')
@Roles(UserRole.BUYER)
@ApiBearerAuth('bearer')
@Controller('buyer/tasks')
export class BuyerRatingController {
    constructor(
        private readonly ratingRepo: RatingRepository,
        private readonly taskRepo: TaskRepository,
        private readonly orderRepo: OrderRepository,
        private readonly workerRepo: WorkerRepository,
    ) { }

    @Post(':taskId/rate')
    @ApiOperation({ summary: 'Rate worker performance on completed task' })
    async rateWorker(
        @Param('taskId') taskId: string,
        @Body()
        body: {
            rating: number;
            feedback?: string;
            categories?: any;
        },
        @CurrentUser() user: User,
    ) {
        if (!body.rating || body.rating < 1 || body.rating > 5) {
            throw new BadRequestException('Rating must be an integer between 1 and 5');
        }

        const task = await this.taskRepo.findById(taskId);
        if (!task) {
            throw new NotFoundException('Task not found');
        }

        if (!task.assignedTo) {
            throw new BadRequestException('Task has not been completed by a worker');
        }

        const order = await this.orderRepo.findById(task.orderId);
        if (!order || order.buyerId !== user.id) {
            throw new ForbiddenException('You can only rate tasks from your own orders');
        }

        const existingRating = await this.ratingRepo.findByTaskId(taskId);
        if (existingRating) {
            throw new BadRequestException('Task has already been rated');
        }

        const ratingRecord = await this.ratingRepo.create({
            taskId,
            workerId: task.assignedTo,
            buyerId: user.id,
            rating: body.rating,
            feedback: body.feedback,
            categories: body.categories || {},
        });

        // Recalculate worker average rating
        const summary = await this.ratingRepo.getWorkerRatingSummary(task.assignedTo);
        const worker = await this.workerRepo.findByUserId(task.assignedTo);
        if (worker) {
            await this.workerRepo.update(worker.id, { averageRating: summary.average });
        }

        return {
            success: true,
            rating: ratingRecord,
            message: 'Worker rated successfully',
        };
    }
}
