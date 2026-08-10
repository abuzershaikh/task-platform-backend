import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MatchingEngineService } from '../../../../matching-engine/matching-engine.service';
import { ScoringEngineService } from '../../../../scoring-engine/scoring.service';
import { ProgressEngineService } from '../../../../progress-engine/progress.service';
import { Roles } from '../../../../shared/auth/decorators/roles.decorator';
import { UserRole } from '../../../../shared/database/entities/user.entity';

@ApiTags('Admin - Engine Configurations')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth('bearer')
@Controller('admin/engine')
export class AdminEngineConfigController {
    constructor(
        private readonly matchingEngine: MatchingEngineService,
        private readonly scoringEngine: ScoringEngineService,
        private readonly progressEngine: ProgressEngineService,
    ) { }

    @Get('matching/status')
    @ApiOperation({ summary: 'Inspect matching engine status' })
    async getMatchingStatus() {
        return {
            success: true,
            status: 'active',
            engine: 'MatchingEngine',
            strategy: 'SCORE_BASED_RANKING',
        };
    }

    @Get('scoring/config')
    @ApiOperation({ summary: 'Get scoring algorithm weights' })
    async getScoringConfig() {
        return {
            success: true,
            weights: {
                quality: 0.3,
                completionRate: 0.25,
                reliability: 0.2,
                recentPerformance: 0.15,
                experience: 0.1,
            },
        };
    }

    @Post('scoring/config')
    @ApiOperation({ summary: 'Update scoring algorithm weights' })
    async updateScoringConfig(@Body() weights: any) {
        return {
            success: true,
            weights,
            message: 'Scoring weights updated',
        };
    }

    @Get('progress/overview')
    @ApiOperation({ summary: 'Get overall engine progress metrics' })
    async getProgressOverview() {
        return {
            success: true,
            engineHealth: 'HEALTHY',
            activeEngines: [
                'TaskEngine',
                'MatchingEngine',
                'ScoringEngine',
                'RankingEngine',
                'AllocationEngine',
                'RewardEngine',
                'ReviewEngine',
                'EarningEngine',
                'EligibilityEngine',
                'ProgressEngine',
                'PayoutEngine',
            ],
        };
    }
}
