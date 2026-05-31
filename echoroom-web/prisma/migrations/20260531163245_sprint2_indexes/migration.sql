-- CreateIndex
CREATE INDEX "Comment_scenarioId_userId_idx" ON "Comment"("scenarioId", "userId");

-- CreateIndex
CREATE INDEX "Comment_moderationStatus_idx" ON "Comment"("moderationStatus");

-- CreateIndex
CREATE INDEX "Scenario_visibility_moderationStatus_createdAt_idx" ON "Scenario"("visibility", "moderationStatus", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Reaction_scenarioId_idx" ON "Reaction"("scenarioId");
