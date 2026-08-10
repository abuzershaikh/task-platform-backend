import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Database & Core Services
import { validateEnvironment } from '../../shared/config/app.config';
import { DatabaseModule } from '../../shared/database/database.module';
import { AuthModule } from '../../shared/auth/auth.module';
import { ServicesModule } from '../../shared/services/services.module';

// Engines
import { TaskEngineModule } from '../../task-engine/task-engine.module';
import { MatchingEngineModule } from '../../matching-engine/matching-engine.module';
import { ScoringEngineModule } from '../../scoring-engine/scoring-engine.module';
import { RankingEngineModule } from '../../ranking-engine/ranking-engine.module';
import { AllocationEngineModule } from '../../allocation-engine/allocation-engine.module';
import { RewardEngineModule } from '../../reward-engine/reward-engine.module';
import { ReviewEngineModule } from '../../review-engine/review-engine.module';
import { EarningEngineModule } from '../../earning-engine/earning-engine.module';
import { EligibilityEngineModule } from '../../eligibility-engine/eligibility-engine.module';
import { ProgressEngineModule } from '../../progress-engine/progress-engine.module';
import { PayoutEngineModule } from '../../payout-engine/payout-engine.module';

// Controllers
import { AuthController } from './controllers/auth/auth.controller';
import { FileController } from './controllers/common/file.controller';

// Worker Controllers
import { WorkerTaskController } from './controllers/worker/task.controller';
import { WorkerEarningController } from './controllers/worker/earning.controller';
import { WorkerProfileController } from './controllers/worker/profile.controller';
import { WorkerKycController } from './controllers/worker/kyc.controller';
import { WorkerRatingController } from './controllers/worker/rating.controller';
import { WorkerPaymentMethodController } from './controllers/worker/payment-method.controller';
import { WorkerNotificationController } from './controllers/worker/notification.controller';

// Buyer Controllers
import { BuyerOrderController } from './controllers/buyer/order.controller';
import { BuyerReviewController } from './controllers/buyer/review.controller';
import { BuyerRatingController } from './controllers/buyer/rating.controller';
import { BuyerBillingController } from './controllers/buyer/billing.controller';
import { BuyerNotificationController } from './controllers/buyer/notification.controller';

// Admin Controllers
import { AdminReviewController } from './controllers/admin/review.controller';
import { AdminAnalyticsController } from './controllers/admin/analytics.controller';
import { AdminBuyerManagementController } from './controllers/admin/buyer-management.controller';
import { AdminWorkerManagementController } from './controllers/admin/worker-management.controller';
import { AdminTaskManagementController } from './controllers/admin/task-management.controller';
import { AdminKycManagementController } from './controllers/admin/kyc-management.controller';
import { AdminPayoutManagementController } from './controllers/admin/payout-management.controller';
import { AdminEngineConfigController } from './controllers/admin/engine-config.controller';
import { AdminAuditLogController } from './controllers/admin/audit-log.controller';

@Module({
    imports: [
        // Config
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
            validate: validateEnvironment,
        }),

        // Database & Services
        DatabaseModule,
        AuthModule,
        ServicesModule,

        // Event Emitter
        EventEmitterModule.forRoot(),

        // All Engines
        TaskEngineModule,
        MatchingEngineModule,
        ScoringEngineModule,
        RankingEngineModule,
        AllocationEngineModule,
        RewardEngineModule,
        ReviewEngineModule,
        EarningEngineModule,
        EligibilityEngineModule,
        ProgressEngineModule,
        PayoutEngineModule,
    ],
    controllers: [
        AuthController,
        FileController,

        // Worker
        WorkerTaskController,
        WorkerEarningController,
        WorkerProfileController,
        WorkerKycController,
        WorkerRatingController,
        WorkerPaymentMethodController,
        WorkerNotificationController,

        // Buyer
        BuyerOrderController,
        BuyerReviewController,
        BuyerRatingController,
        BuyerBillingController,
        BuyerNotificationController,

        // Admin
        AdminReviewController,
        AdminAnalyticsController,
        AdminBuyerManagementController,
        AdminWorkerManagementController,
        AdminTaskManagementController,
        AdminKycManagementController,
        AdminPayoutManagementController,
        AdminEngineConfigController,
        AdminAuditLogController,
    ],
})
export class AppModule { }
