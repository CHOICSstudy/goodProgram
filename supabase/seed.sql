insert into accounts (label, site, login_id, login_password) values
  ('계정1', 'inflearn.com', 'team-acc1@example.com', 'pw-account-1'),
  ('계정2', 'inflearn.com', 'team-acc2@example.com', 'pw-account-2');

insert into courses (title, category, account_id) values
  ('스프링 부트 입문', 'backend', (select id from accounts where label = '계정1')),
  ('리액트 완벽 가이드', 'frontend', (select id from accounts where label = '계정1')),
  ('리눅스 서버 운영', 'server', (select id from accounts where label = '계정2'));
