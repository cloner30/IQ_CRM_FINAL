import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export const PartyStatementLedger = ({ title = 'Account Statement (Dr / Cr)', lines = [], emptyMessage = 'No ledger entries yet.' }) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <p className="text-sm text-muted-foreground">
        Debit increases balance owed; credit reduces it. Running balance shown as Dr (due) or Cr (advance).
      </p>
    </CardHeader>
    <CardContent className="overflow-x-auto">
      {lines.length === 0 ? (
        <p className="text-muted-foreground">{emptyMessage}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Particulars</th>
              <th className="py-2 pr-4">Reference</th>
              <th className="py-2 pr-4 text-right">Debit (Dr)</th>
              <th className="py-2 pr-4 text-right">Credit (Cr)</th>
              <th className="py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={`${line.entry_date}-${line.reference}-${idx}`} className="border-b">
                <td className="py-2 pr-4 whitespace-nowrap">{line.entry_date}</td>
                <td className="py-2 pr-4">{line.particulars}</td>
                <td className="py-2 pr-4 text-muted-foreground text-xs">{line.reference}</td>
                <td className="py-2 pr-4 text-right font-medium">
                  {line.debit != null ? `$${line.debit.toFixed(2)}` : ''}
                </td>
                <td className="py-2 pr-4 text-right font-medium">
                  {line.credit != null ? `$${line.credit.toFixed(2)}` : ''}
                </td>
                <td className="py-2 text-right font-semibold">
                  ${line.running_balance?.toFixed(2)} {line.balance_side}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </CardContent>
  </Card>
);
