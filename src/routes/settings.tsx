import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Schore" }] }),
  component: Settings,
});

const users = [
  { name: "Daniel Schore", role: "CEO", email: "daniel@schore.co.uk", status: "Active" },
  { name: "Marcus Reid", role: "CM", email: "marcus@schore.co.uk", status: "Active" },
  { name: "Florin Vasile", role: "PM", email: "florin@schore.co.uk", status: "Active" },
  { name: "Claudiu Ceausu", role: "SM", email: "claudiu@schore.co.uk", status: "Active" },
];

function Settings() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Team, roles and platform configuration" />

      <div className="card-elevated">
        <div className="p-5 border-b">
          <h3 className="font-display font-semibold">Team & roles</h3>
          <p className="text-xs text-muted-foreground">CEO/CM/PM can edit rates · SM can view but not edit rates</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-5 py-2.5">Name</th>
              <th className="text-left font-medium px-3 py-2.5">Role</th>
              <th className="text-left font-medium px-3 py-2.5">Email</th>
              <th className="text-left font-medium px-3 py-2.5">Edit rates?</th>
              <th className="text-left font-medium px-5 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map(u => (
              <tr key={u.email}>
                <td className="px-5 py-3 font-medium">{u.name}</td>
                <td className="px-3 py-3"><code className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">{u.role}</code></td>
                <td className="px-3 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-3 py-3">{u.role === "SM" ? <span className="text-destructive text-xs">No</span> : <span className="text-success text-xs">Yes</span>}</td>
                <td className="px-5 py-3"><StatusBadge status={u.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
