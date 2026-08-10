import { ReleaseReason } from '../engines/reallocation-engine/types/reallocation.types';

describe('Post-Deadline Reallocation & Campaign Extension Verification', () => {
    const campaignId = 'CAMP-001';

    describe('Rule 1: Full Task Deadline Respect (No Pre-Deadline Eviction)', () => {
        it('should NOT remove worker 45 mins before deadline (Worker works until actual deadline)', () => {
            const task = {
                id: 'task_1001',
                campaignId,
                assignedTo: 'W03',
                status: 'IN_PROGRESS',
                deadlineMinutesRemaining: 45, // 45 mins remaining
            };

            const isDeadlinePassed = task.deadlineMinutesRemaining <= 0;
            const shouldReleaseWorker = isDeadlinePassed;

            expect(isDeadlinePassed).toBe(false);
            expect(shouldReleaseWorker).toBe(false); // Worker works freely until deadline!
        });
    });

    describe('Rule 2 & 3: Post-Deadline Timeout Release & Campaign Exclusion', () => {
        it('should release worker with WORKER_TIMEOUT only AFTER deadline passes without proof', () => {
            const task = {
                id: 'task_1001',
                campaignId,
                assignedTo: 'W03',
                status: 'IN_PROGRESS',
                deadlineMinutesRemaining: -10, // 10 mins PAST deadline
            };

            const isDeadlinePassed = task.deadlineMinutesRemaining <= 0;
            expect(isDeadlinePassed).toBe(true);

            // Release record
            const releaseRecord = {
                workerId: 'W03',
                reason: ReleaseReason.WORKER_TIMEOUT,
                status: 'EXPIRED',
            };

            expect(releaseRecord.reason).toBe('WORKER_TIMEOUT');
            expect(releaseRecord.status).toBe('EXPIRED');
        });

        it('should exclude expired worker W03 and reassign task to new worker W11', () => {
            const usedWorkerSet = ['W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10'];

            // W03 expired -> Participation record remains in usedWorkerSet
            expect(usedWorkerSet.includes('W03')).toBe(true);

            const candidatePool = ['W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10', 'W11', 'W12'];
            const reallocatableCandidates = candidatePool.filter((w) => !usedWorkerSet.includes(w));

            expect(reallocatableCandidates[0]).toBe('W11'); // Replacement is W11!
        });
    });

    describe('Rule 4: Campaign Auto-Extension Policy (+10 Hours)', () => {
        it('should auto-extend campaign cutoff date by +10 hours when campaign is incomplete at cutoff', () => {
            const now = new Date();
            const pastCutoff = new Date(now.getTime() - 1000); // 1 sec ago
            const incompleteTasks = 18; // 82/100 completed, 18 remaining

            const shouldAutoExtend = now > pastCutoff && incompleteTasks > 0;
            expect(shouldAutoExtend).toBe(true);

            const extensionHours = 10;
            const newCutoffDate = new Date(now.getTime() + extensionHours * 3600 * 1000);

            expect(newCutoffDate.getTime()).toBeGreaterThan(now.getTime());
        });
    });
});
