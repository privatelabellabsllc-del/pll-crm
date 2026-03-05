interface Window {
  tasklet: {
    sqlQuery: (query: string, params?: any[]) => Promise<any[]>;
    sqlExec: (query: string, params?: any[]) => Promise<{ lastInsertRowid?: number; changes?: number }>;
  };
}
