DROP INDEX IF EXISTS "menu_items_label_parentId_key";

CREATE UNIQUE INDEX "menu_items_label_null_parent_key" 
ON "menu_items"("label") 
WHERE "parentId" IS NULL;

CREATE UNIQUE INDEX "menu_items_label_parent_key" 
ON "menu_items"("label", "parentId") 
WHERE "parentId" IS NOT NULL;