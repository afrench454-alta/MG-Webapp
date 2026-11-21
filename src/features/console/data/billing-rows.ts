const BILLING_PAGE_SIZE = 1000;

type BillingPage<Row> = { data: Row[] | null; error: { message: string } | null };

export async function readBillingRows<Row>(
  fetchPage: (from: number, to: number) => PromiseLike<BillingPage<Row>>,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += BILLING_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + BILLING_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < BILLING_PAGE_SIZE) return rows;
  }
}
