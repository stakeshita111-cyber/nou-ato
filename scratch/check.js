const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rarwrsrmkubhcndfpokl.supabase.co';
const supabaseAnonKey = 'sb_publishable_fxOlNtgJTxAZNzP6QxN-Uw_8SwxpgIe';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const columns = ['tasks_id', 'taskid', 'parent_id', 'task_uuid'];
  for (const col of columns) {
    const { error } = await supabase.from('student_tasks').select(col).limit(1);
    if (error) {
      console.log(`Column [${col}]: ❌ NOT EXISTS`);
    } else {
      console.log(`Column [${col}]:  EXISTS`);
    }
  }
}

main();
