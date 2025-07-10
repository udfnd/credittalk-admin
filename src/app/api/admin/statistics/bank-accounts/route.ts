// src/app/api/admin/statistics/bank-accounts/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  return isAdmin === true;
}

interface BankAccount {
  bankName: string;
}

export async function GET() {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // Let's assume the table is `scammer_reports` and the column is `bank_accounts` as per the problem description.
    const { data: reports, error } = await supabaseAdmin
      .from('scammer_reports')
      .select('damage_accounts');

    if (error) throw error;

    const bankCounts: Record<string, number> = {};

    reports.forEach(report => {
      // The bank_accounts column is expected to be a JSON array of objects
      if (report.damage_accounts && Array.isArray(report.damage_accounts)) {
        report.damage_accounts.forEach((account: BankAccount) => {
          if (account.bankName) {
            bankCounts[account.bankName] = (bankCounts[account.bankName] || 0) + 1;
          }
        });
      }
    });

    const result = Object.entries(bankCounts)
      .map(([bank_name, report_count]) => ({ bank_name, report_count }))
      .sort((a, b) => b.report_count - a.report_count);

    return NextResponse.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error fetching bank account stats:', errorMessage);
    return new NextResponse(errorMessage, { status: 500 });
  }
}
