/*
* types.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

export type User = {
  guid: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  user_role: string;
  created_time: string;
  updated_time: string;
  active_time: string;
  confirmed: boolean;
  locked: boolean;
};

export type Content = {
  guid: string;
  name: string;
  title: string;
  content_url: string;
  dashboard_url: string;
};

export type Bundle = {
  id: string;
  content_guid: string;
};

export type Task = {
  task_id: string;
};

export type TaskStatus = {
  id: string;
  finished: boolean;
  code: number;
  error: string;
};
