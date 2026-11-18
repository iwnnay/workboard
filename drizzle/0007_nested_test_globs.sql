UPDATE `project` SET `settings` = replace(`settings`, '"testGlobs":["tests/**"]', '"testGlobs":["**/tests/**"]') WHERE `settings` LIKE '%"testGlobs":["tests/**"]%';
