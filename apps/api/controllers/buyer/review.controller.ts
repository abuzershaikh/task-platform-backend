import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewEngineService } from '../../../../review-engine/review.service';
import { SubmissionRepository } from '../../../../shared/database/repositories/submission.repository';
import { OrderRepository } from '../../../../shared/database/repositories/order.repository';
import { TaskRepository } from '../../../../shared/database/repositories/task.repository';
import { Roles } from '../../../../shared/auth/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/auth/decorators/current-user.decorator';
import { UserRole, User } from '../../../../shared/database/entities/user.entity';

@ApiTags('Buyer - Reviews')
@Roles(UserRole.BUYER)
@ApiBearerAuth('bearer')
@Controller('buyer/reviews')
export class BuyerReviewController {
    constructor(
        private readonly reviewEngine: ReviewEngineService,
        private readonly submissionRepo: SubmissionRepository,
        private readonly orderRepo: OrderRepository,
        private readonly taskRepo: TaskRepository,
    ) { }

    @Get('pending')
    @ApiOperation({ summary: 'Get pending submission review queue for buyer' })
    async getPendingReviews(@CurrentUser() user: User) {
        const buyerOrders = await this.orderRepo.findByBuyer(user.id);
        const orderIds = buyerOrders.map((o) => o.id);

        if (orderIds.length === 0) {
            return { success: true, submissions: [] };
        }

        const pendingSubmissions = await this.submissionRepo.findPendingReviews();
        const buyerPendingSubmissions: any[] = [];

        for (const sub of pendingSubmissions) {
            const task = await this.taskRepo.findById(sub.taskId);
            if (task && orderIds.includes(task.orderId)) {
                buyerPendingSubmissions.push({
                    ...sub,
                    taskTitle: task.taskType,
                    orderId: task.orderId,
                });
            }
        }

        return {
            success: true,
            submissions: buyerPendingSubmissions,
            count: buyerPendingSubmissions.length,
        };
    }

    @Post(':submissionId/approve')
    @ApiOperation({ summary: 'Approve submission' })
    async approveSubmission(
        @Param('submissionId') submissionId: string,
        @Body() body: { notes?: string },
        @CurrentUser() user: User,
    ) {
        const submission = await this.submissionRepo.findById(submissionId);
        if (!submission) {
            throw new NotFoundException('Submission not found');
        }

        const task = await this.taskRepo.findById(submission.taskId);
        if (!task) {
            throw new NotFoundException('Task not found');
        }

        const order = await this.orderRepo.findById(task.orderId);
        if (!order || order.buyerId !== user.id) {
            throw new ForbiddenException('You do not have access to review this submission');
        }

        const review = await this.reviewEngine.reviewSubmission(submissionId, {
            action: 'approved',
            reviewedBy: user.id,
            notes: body.notes,
        });

        return {
            success: true,
            review,
            message: 'Submission approved successfully',
        };
    }

    @Post(':submissionId/reject')
    @ApiOperation({ summary: 'Reject submission' })
    async rejectSubmission(
        @Param('submissionId') submissionId: string,
        @Body() body: { notes?: string },
        @CurrentUser() user: User,
    ) {
        const submission = await this.submissionRepo.findById(submissionId);
        if (!submission) {
            throw new NotFoundException('Submission not found');
        }

        const task = await this.taskRepo.findById(submission.taskId);
        if (!task) {
            throw new NotFoundException('Task not found');
        }

        const order = await this.orderRepo.findById(task.orderId);
        if (!order || order.buyerId !== user.id) {
            throw new ForbiddenException('You do not have access to review this submission');
        }

        const review = await this.reviewEngine.reviewSubmission(submissionId, {
            action: 'rejected',
            reviewedBy: user.id,
            notes: body.notes || 'Submission rejected by buyer',
        });

        return {
            success: true,
            review,
            message: 'Submission rejected',
        };
    }
}
