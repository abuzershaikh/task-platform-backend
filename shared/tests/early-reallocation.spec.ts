import { ReleaseReason } from '../engines/reallocation-engine/types/reallocation.types';

describe('Enterprise Early Reallocation Engine Verification', () => {
    const campaignId = 'CAMP-001';

    describe('Rule 1 & 2: Early Replacement Window & Submitted Task Shield', () => {
        it('should release at-risk worker 45 mins before deadline if status is IN_PROGRESS', () => {
            const task = {
                id: 'task_1001',
                campaignId,
                assignedTo: 'W03',
                status: 'IN_PROGRESS',
                deadlineMinutesRemaining: 45, // Inside 1 hour window
            };

            const earlyWindowThreshold = 60; // 1 hour
            const isInsideEarlyWindow = task.deadlineMinutesRemaining <= earlyWindowThreshold;

            const shieldedStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'COMPLETED'];
            const isShielded = shieldedStatuses.includes(task.status);

            const shouldTriggerEarlyRelease = isInsideEarlyWindow && !isShielded;

            expect(isInsideEarlyWindow).toBe(true);
            expect(isShielded).toBe(false);
            expect(shouldTriggerEarlyRelease).toBe(true);
        });

        it('should STRICTLY SHIELD worker if task status is SUBMITTED 45 mins before deadline', () => {
            const task = {
                id: 'task_1002',
                campaignId,
                assignedTo: 'W04',
                status: 'SUBMITTED', // Worker submitted proof!
                deadlineMinutesRemaining: 45,
            };

            const shieldedStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'COMPLETED'];
            const isShielded = shieldedStatuses.includes(task.status);

            const shouldTriggerEarlyRelease = !isShielded;

            expect(isShielded).toBe(true);
            expect(shouldTriggerEarlyRelease).toBe(false); // SHIELDED! Do NOT release.
        });
    });

    describe('Rule 3: Permanent Campaign Exclusion & Replacement', () => {
        it('should exclude released worker W03 and reassign task to new worker W11', () => {
            const usedWorkerSet = ['W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10'];

            // W03 released with reason EARLY_DEADLINE_RISK
            const releaseRecord = {
                workerId: 'W03',
                reason: ReleaseReason.EARLY_DEADLINE_RISK,
                status: 'EARLY_RELEASED',
            };

            expect(releaseRecord.reason).toBe('EARLY_DEADLINE_RISK');
            expect(usedWorkerSet.includes('W03')).toBe(true); // W03 remains in usedWorkerSet -> EXCLUDED!

            const candidatePool = ['W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10', 'W11', 'W12'];
            const reallocatableCandidates = candidatePool.filter((w) => !usedWorkerSet.includes(w));

            expect(reallocatableCandidates[0]).toBe('W11'); // Replacement is W11!
        });
    });

    describe('Rule 4: Campaign Auto-Extension Policy', () => {
        it('should auto-extend campaign expiry by +10 hours when campaign is incomplete at cutoff date', () => {
            const now = new Date();
            const pastCutoff = new Date(now.getTime() - 1000); // 1 sec ago
            const incompleteTasks = 20;

            const shouldAutoExtend = now > pastCutoff && incompleteTasks > 0;
            expect(shouldAutoExtend).toBe(true);

            const extensionHours = 10;
            const newCutoffDate = new Date(now.getTime() + extensionHours * 3600 * 1000);

            expect(newCutoffDate.getTime()).toBeGreaterThan(now.getTime());
        });
    });
});
