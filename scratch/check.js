const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rarwrsrmkubhcndfpokl.supabase.co';
const supabaseAnonKey = 'sb_publishable_fxOlNtgJTxAZNzP6QxN-Uw_8SwxpgIe';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: tasks, error: err1 } = await supabase
    .from('tasks')
    .select('*')
    .eq('title', 'ううう');
  
  console.log("=== tasks table matching 'ううう' ===");
  console.log(tasks);

  const { data: studentTasks, error: err2 } = await supabase
    .from('student_tasks')
    .select('*, tasks(*)');

  console.log("=== student_tasks table ===");
  console.log(studentTasks);
}

main();
