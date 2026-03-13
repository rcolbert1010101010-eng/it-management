import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil } from "lucide-react";

interface ManagedUser {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
  created_at: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editPassword, setEditPassword] = useState("");

  const callManageUsers = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const res = await supabase.functions.invoke("manage-users", { body });
    if (res.error) throw new Error(res.error.message);
    if (res.data?.error) throw new Error(res.data.error);
    return res.data;
  };

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    setIsAdmin(data?.is_admin || false);
  };

  const fetchUsers = async () => {
    try {
      const data = await callManageUsers({ action: "list" });
      setUsers(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAdmin().then(fetchUsers);
  }, []);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await callManageUsers({
        action: "create",
        email: newEmail,
        password: newPassword,
        display_name: newDisplayName || newEmail,
        is_admin: newIsAdmin,
      });
      toast({ title: "User created" });
      setCreateOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewDisplayName("");
      setNewIsAdmin(false);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Delete this user?")) return;
    try {
      await callManageUsers({ action: "delete", user_id: userId });
      toast({ title: "User deleted" });
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const openEdit = (user: ManagedUser) => {
    setEditUser(user);
    setEditDisplayName(user.display_name);
    setEditIsAdmin(user.is_admin);
    setEditPassword("");
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    setSubmitting(true);
    try {
      await callManageUsers({
        action: "update",
        user_id: editUser.id,
        display_name: editDisplayName,
        is_admin: editIsAdmin,
        ...(editPassword ? { password: editPassword } : {}),
      });
      toast({ title: "User updated" });
      setEditOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Users" />
        <p className="text-muted-foreground">You need admin access to manage users.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Users">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" />
              </div>
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={newIsAdmin} onCheckedChange={setNewIsAdmin} />
                <Label>Admin</Label>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={submitting || !newEmail || !newPassword}>
                {submitting ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.display_name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <StatusBadge status={u.is_admin ? "ADMIN" : "USER"} />
                </TableCell>
                <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>New Password (leave blank to keep current)</Label>
              <Input value={editPassword} onChange={(e) => setEditPassword(e.target.value)} type="password" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editIsAdmin} onCheckedChange={setEditIsAdmin} />
              <Label>Admin</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdate} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
