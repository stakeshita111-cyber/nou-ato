-- ==============================================================================
-- NOU-ATO (のうあと) デモデータ再投入用 SQL (seed_demo_data.sql)
-- 目的: レビュー時に消失したデモ用「相談・日誌」レコードおよびAI承認ナレッジを復元
-- ==============================================================================

-- ①「きゅうりの苗が元気ありません」と講師返信
INSERT INTO public.journals (
    student_id,
    farm_id,
    role,
    content,
    reply,
    is_private,
    is_approved,
    created_at,
    updated_at
)
SELECT 
    u.id,
    u.farm_id,
    'student',
    '【畝 1 (きゅうり)】きゅうりの苗が元気ありません。葉の先が少し黄色くなって垂れ下がっています。水やりは毎日朝夕2回していますが、何か対策はありますでしょうか？',
    '葉の先が黄色くなる場合、水のやりすぎによる「根腐れ」の初期症状の可能性があります！今の時期は朝1回、土の表面が乾いてからたっぷりと与えるペースに調整してみてくださいね。数日で新芽にハリが戻るか観察してみましょう。',
    false,
    false,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days' + INTERVAL '30 minutes'
FROM public.users u
WHERE u.role = 'student'
  AND NOT EXISTS (
      SELECT 1 FROM public.journals WHERE content LIKE '%きゅうりの苗が元気ありません%'
  )
ORDER BY u.created_at ASC
LIMIT 1;

-- ②「ありがとうございました＿TEST」と講師返信
INSERT INTO public.journals (
    student_id,
    farm_id,
    role,
    content,
    reply,
    is_private,
    is_approved,
    created_at,
    updated_at
)
SELECT 
    u.id,
    u.farm_id,
    'student',
    'アドバイスありがとうございます！水やりを朝1回に控えたところ、元気を取り戻してきました。ありがとうございました＿TEST',
    '順調に回復して安心しました！きゅうりは根が浅くデリケートなので、土の乾き具合を指で触って確認するのがコツです。この調子で収穫まで見守りましょう🌱',
    false,
    false,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day' + INTERVAL '1 hour'
FROM public.users u
WHERE u.role = 'student'
  AND NOT EXISTS (
      SELECT 1 FROM public.journals WHERE content LIKE '%ありがとうございました＿TEST%'
  )
ORDER BY u.created_at ASC
LIMIT 1;

-- ③ AI承認ナレッジ (ミニトマトのわき芽かき)
INSERT INTO public.journals (
    student_id,
    farm_id,
    role,
    content,
    reply,
    is_private,
    is_approved,
    created_at,
    updated_at
)
SELECT 
    u.id,
    u.farm_id,
    'student',
    '【畝 2 (ミニトマト)】ミニトマトのわき芽かきについて教えてください。どの枝を摘み取ればよいですか？',
    '主枝（メインの太い茎）と本葉の間から斜め45度に出てくる小さな芽が「わき芽」です。晴れた日の午前中に手でポキッと折るように摘み取ってください。晴れていると傷口が早く乾いて病気を防げます！',
    false,
    true,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days' + INTERVAL '45 minutes'
FROM public.users u
WHERE u.role = 'student'
  AND NOT EXISTS (
      SELECT 1 FROM public.journals WHERE content LIKE '%ミニトマトのわき芽かきについて%'
  )
ORDER BY u.created_at ASC
LIMIT 1;
