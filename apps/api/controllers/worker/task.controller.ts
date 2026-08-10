import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    Query,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TaskEngineService } from '../../../../task-engine/task-engine.service';
import { ProgressEngineService } from '../../../../progress-engine/progress.service';
import { CurrentUser } from '../../../../shared/auth/decorators/current-user.decorator';
import { Roles } from '../../../../shared/auth/decorators/roles.decorator';
import { UserRole, User } from '../../../../shared/database/entities/user.entity';

@ApiTags('Worker - Tasks')
@Roles(UserRole.WORKER)
@ApiBearerAuth('bearer')
@Controller('worker/tasks')
export class WorkerTaskController {
    constructor(
        private readonly taskEngine: TaskEngineService,
        private readonly progressEngine: ProgressEngineService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Get worker tasks with optional status filter' })
    @ApiQuery({ name: 'status', required: false })
    async getTasks(@CurrentUser() user: User, @Query('status') status?: string) {
        if (status === 'available') {
            const tasks = await this.taskEngine.getAvailableTasks(user.id);
            return { success: true, tasks };
        }

        const tasks = await this.taskEngine.getWorkerTasks(user.id, status);
        return { success: true, tasks };
    }

    @Get('available')
    @ApiOperation({ summary: 'Get available tasks for worker' })
    async getAvailableTasks(@CurrentUser() user: User) {
        const tasks = await this.taskEngine.getAvailableTasks(user.id);
        return {
            success: true,
            tasks,
            message: 'Available tasks fetched',
        };
    }

    @Get('assigned')
    @ApiOperation({ summary: 'Get tasks assigned to worker' })
    async getAssignedTasks(@CurrentUser() user: User) {
        const tasks = await this.taskEngine.getWorkerTasks(user.id, 'assigned');
        return {
            success: true,
            tasks,
            message: 'Assigned tasks fetched',
        };
    }

    @Get('progress')
    @ApiOperation({ summary: 'Get worker task progress summary' })
    async getProgress(@CurrentUser() user: User) {
        const progress = await this.progressEngine.getWorkerProgress(user.id);
        return {
            success: true,
            progress,
        };
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get worker task details with ownership check' })
    async getTaskDetails(@Param('id') taskId: string, @CurrentUser() user: User) {
        const task = await this.taskEngine.getTaskById(taskId);
        if (!task) {
            throw new NotFoundException('Task not found');
        }

        if (task.assignedTo && task.assignedTo !== user.id) {
            throw new ForbiddenException('You do not have permission to view this task');
        }

        return {
            success: true,
            task,
        };
    }

    @Post(':id/accept')
    @ApiOperation({ summary: 'Accept an assigned task' })
    async acceptTask(@Param('id') taskId: string, @CurrentUser() user: User) {
        await this.taskEngine.acceptTask({ taskId, workerId: user.id });
        return {
            success: true,
            message: 'Task accepted successfully',
        };
    }

    @Post(':id/start')
    @ApiOperation({ summary: 'Start work on accepted task' })
    async startTask(@Param('id') taskId: string, @CurrentUser() user: User) {
        await this.taskEngine.startTask({ taskId, workerId: user.id });
        return {
            success: true,
            message: 'Task started',
        };
    }

    @Post(':id/submit')
    @ApiOperation({ summary: 'Submit completed task with proof data' })
    async submitTask(
        @Param('id') taskId: string,
        @Body() body: { data?: any; proofs?: any[] },
        @CurrentUser() user: User,
    ) {
        await this.taskEngine.submitTask({
            taskId,
            workerId: user.id,
            data: {
                ...(body.data || body),
                proofs: body.proofs || [],
            },
        });
        return {
            success: true,
            message: 'Task submitted for review',
        };
    }
}
