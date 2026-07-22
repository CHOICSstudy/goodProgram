export type Account = {
  id: string;
  label: string;
  site: string;
};

export type AccountWithCredentials = Account & {
  login_id: string;
  login_password: string;
};

export type Course = {
  id: string;
  title: string;
  category: string;
  account_id: string;
};

export type Session = {
  id: string;
  account_id: string;
  member_name: string;
  checked_in_at: string;
  planned_checkout_at: string | null;
  checked_out_at: string | null;
};

export type Reservation = {
  id: string;
  course_id: string | null;
  account_id: string;
  member_name: string;
  start_at: string;
  end_at: string;
};

export type AccountStatus = Account & {
  activeSession: {
    id: string;
    member_name: string;
    effective_checkout_at: string;
  } | null;
};

export type StatusPayload = {
  accounts: AccountStatus[];
  courses: Course[];
  todayReservations: Reservation[];
};
