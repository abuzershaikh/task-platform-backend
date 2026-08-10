import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ReviewEngineService } from '../../../../review-engine/review.service';
import { SubmissionRepository } from '../../../../shared/database/repositories/submission.repository';
import { Roles } from '../../../../shared/auth/decorators/roles.decorator';
import { UserRole } from '../../../../shared/database/entities/user.entity';

/**
 * Admin Review APIs
 */
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/reviews')
export class AdminReviewController {
    constructor(
        private readonly reviewEngine: ReviewEngineService,
        private readonly submissionRepo: SubmissionRepository,
    ) { }

    @Get('pending')
    async getPendingReviews() {
        const submissions = await this.submissionRepo.findPendingReviews();

        return {
            success: true,
            submissions,
            count: submissions.length,
        };
    }

    @Post(':submissionId/approve')
    async approveSubmission(
        @Param('submissionId') submissionId: string,
        @Body() data: any,
    ) {
        const review = await this.reviewEngine.reviewSubmission(submissionId, {
            action: 'approved',
            reviewedBy: data.reviewedBy || 'admin',
            notes: data.notes,
        });

        return {
            success: true,
            review,
            message: 'Submission approved',
        };
    }

    @Post(':submissionId/reject')
    async rejectSubmission(
        @Param('submissionId') submissionId: string,
        @Body() data: any,
    ) {
        const review = await this.reviewEngine.reviewSubmission(submissionId, {
            action: 'rejected',
            reviewedBy: data.reviewedBy || 'admin',
            notes: data.notes || 'Does not meet requirements',
        });

        return {
            success: true,
            review,
            message: 'Submission rejected',
        };
    }

    @Get('stats')
    async getReviewStats() {
        // TODO: Calculate review statistics
        return {
            success: true,
            stats: {
                pending: 0,
                approved: 0,
                rejected: 0,
            },
        };
    }
}
