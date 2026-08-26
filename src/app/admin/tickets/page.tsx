"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTickets, updateTicketStatus, getTicketUpdates, createTicketUpdate } from "@/services/ticketService";
import { getLocations } from "@/services/locationService";
import { getQRCodes } from "@/services/qrService";
import type { Ticket, TicketUpdate, TicketStatus } from "@/types";
import { Plus, MessageSquare, Filter } from "lucide-react";

const STATUS_OPTIONS: { value: TicketStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "NEW", label: "New" },
  { value: "ACKNOWLEDGED", label: "Acknowledged" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<TicketStatus | "ALL">("ALL");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [updates, setUpdates] = useState<TicketUpdate[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<Record<string, { name: string; code: string }>>({});
  const [qrCodes, setQRCodes] = useState<Record<string, string>>({});
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function loadData() {
      try {
        const [ticketsData, locationsData, qrCodesData] = await Promise.all([
          getTickets(undefined, filterStatus === "ALL" ? undefined : filterStatus),
          getLocations(),
          getQRCodes(),
        ]);
        if (cancelled) return;
        setTickets(ticketsData);
        const locMap: Record<string, { name: string; code: string }> = {};
        for (const loc of locationsData) {
          locMap[loc.id] = { name: loc.name, code: loc.code };
        }
        setLocations(locMap);
        const qrMap: Record<string, string> = {};
        for (const qr of qrCodesData) {
          qrMap[qr.id] = qr.qrCode;
        }
        setQRCodes(qrMap);
      } catch (err) {
        console.error("Failed to load tickets:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [filterStatus]);

  const handleViewTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    try {
      const ticketUpdates = await getTicketUpdates(ticket.id);
      setUpdates(ticketUpdates);
    } catch {
      setUpdates([]);
    }
    setNewMessage("");
  };

  const handleStatusChange = async (ticketId: string, status: TicketStatus) => {
    setSaving(true);
    try {
      await updateTicketStatus(ticketId, status);
      setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status } : t));
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
    } catch {
      // handle error silently or show toast
    } finally {
      setSaving(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!selectedTicket || !newMessage.trim()) return;
    setSaving(true);
    try {
      const updateId = await createTicketUpdate({
        ticketId: selectedTicket.id,
        message: newMessage.trim(),
        createdBy: "admin",
      });
      const newUpdate = await getTicketUpdates(selectedTicket.id).then(us => us.find(u => u.id === updateId));
      if (newUpdate) {
        setUpdates((prev) => [...prev, newUpdate]);
      }
      setNewMessage("");
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case "NEW": return "bg-blue-100 text-blue-700";
      case "ACKNOWLEDGED": return "bg-yellow-100 text-yellow-700";
      case "ASSIGNED": return "bg-purple-100 text-purple-700";
      case "IN_PROGRESS": return "bg-orange-100 text-orange-700";
      case "RESOLVED": return "bg-green-100 text-green-700";
      case "CLOSED": return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground">View and manage reported issues.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as TicketStatus | "ALL")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>All Tickets</CardTitle>
          <CardDescription>{tickets.length} ticket{tickets.length !== 1 ? "s" : ""} found</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No tickets yet</h3>
              <p className="text-muted-foreground">Issues reported via QR codes will appear here.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-mono text-xs">{ticket.ticketId}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{locations[ticket.issueLocationId]?.name || ticket.issueLocationId}</span>
                          <span className="text-xs text-muted-foreground">{locations[ticket.issueLocationId]?.code || ""}</span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{ticket.category.replace("_", " ").toLowerCase()}</TableCell>
                      <TableCell className="capitalize">{ticket.priority.toLowerCase()}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(ticket.status)}`}>
                          {ticket.status.replace("_", " ")}
                        </span>
                      </TableCell>
                      <TableCell>{new Date(ticket.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleViewTicket(ticket)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTicket} onOpenChange={(open) => { if (!open) { setSelectedTicket(null); setUpdates([]); } }}>
        <DialogContent className="sm:max-w-lg">
          {selectedTicket && (
              <>
                <DialogHeader>
                  <DialogTitle>Ticket {selectedTicket.ticketId}</DialogTitle>
                  <DialogDescription>
                    {locations[selectedTicket.issueLocationId]?.name} ({locations[selectedTicket.issueLocationId]?.code})
                  </DialogDescription>
                </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category</span>
                    <p className="font-medium capitalize">{selectedTicket.category.replace("_", " ").toLowerCase()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Priority</span>
                    <p className="font-medium capitalize">{selectedTicket.priority.toLowerCase()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <Select value={selectedTicket.status} onValueChange={(v) => handleStatusChange(selectedTicket.id, v as TicketStatus)}>
                      <SelectTrigger className="mt-1 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NEW">New</SelectItem>
                        <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                        <SelectItem value="ASSIGNED">Assigned</SelectItem>
                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                        <SelectItem value="RESOLVED">Resolved</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <span className="text-muted-foreground">QR Code</span>
                    <p className="font-mono text-xs">{qrCodes[selectedTicket.qrId] || selectedTicket.qrId}</p>
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Description</span>
                  <p className="mt-1 rounded-md bg-muted p-3 text-sm">{selectedTicket.description}</p>
                </div>
                {selectedTicket.reporterPhone && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Reporter:</span> {selectedTicket.reporterName || "Anonymous"} ({selectedTicket.reporterPhone})
                  </div>
                )}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Updates</span>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                    {updates.length === 0 && <p className="text-sm text-muted-foreground">No updates yet.</p>}
                    {updates.map((update) => (
                      <div key={update.id} className="text-sm">
                        <p>{update.message}</p>
                        <p className="text-xs text-muted-foreground">{new Date(update.createdAt).toLocaleString()} by {update.createdBy}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Add an update..."
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddUpdate(); }}
                  />
                  <Button onClick={handleAddUpdate} disabled={saving || !newMessage.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setSelectedTicket(null); setUpdates([]); }}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
