"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  addStudentsBaseSchema,
  type AddStudentsFormValues,
} from "@/schemas/group-membership";
import { addStudentsToGroup } from "@/lib/actions/group-memberships";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Plus, X } from "lucide-react";

type StudentOption = {
  id: string;
  crmCode: string;
  firstName: string;
  lastName: string;
  status: string;
};

interface AddStudentDialogProps {
  groupId: string;
  students: StudentOption[];
}

export function AddStudentDialog({ groupId, students }: AddStudentDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const form = useForm<AddStudentsFormValues>({
    resolver: zodResolver(addStudentsBaseSchema),
    defaultValues: {
      studentIds: [],
      joinDate: new Date().toISOString().split("T")[0]!,
      isTrial: true,
      comment: null,
    },
  });

  const selectedIds = form.watch("studentIds");

  const filteredStudents = students.filter((s) => {
    if (selectedIds.includes(s.id)) return false;
    const q = search.toLowerCase();
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.crmCode.toLowerCase().includes(q)
    );
  });

  function onSubmit(values: AddStudentsFormValues) {
    startTransition(async () => {
      const result = await addStudentsToGroup(groupId, values);
      if (result?.error) {
        toast.error(result.error);
      } else {
        const count = values.studentIds.length;
        toast.success(
          `${count} student${count === 1 ? "" : "s"} added to group`,
        );
        setOpen(false);
        form.reset();
        setSearch("");
      }
    });
  }

  function removeStudent(id: string) {
    form.setValue(
      "studentIds",
      selectedIds.filter((sid) => sid !== id),
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          form.reset();
          setSearch("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 size-4" />
          Add Student
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Students to Group</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Student Multi-Select */}
            <FormField
              control={form.control}
              name="studentIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Students</FormLabel>

                  {/* Selected chips */}
                  {selectedIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedIds.map((id) => {
                        const s = students.find((st) => st.id === id);
                        if (!s) return null;
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-sm"
                          >
                            <span className="font-mono text-xs text-muted-foreground">
                              {s.crmCode}
                            </span>
                            {s.firstName} {s.lastName}
                            <button
                              type="button"
                              onClick={() => removeStudent(id)}
                              className="ml-0.5 text-muted-foreground hover:text-foreground"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Search */}
                  <div className="space-y-2">
                    <Input
                      placeholder="Search by name or CRM code..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search.length > 0 && (
                      <div className="max-h-40 overflow-y-auto rounded-md border">
                        {filteredStudents.length === 0 ? (
                          <p className="p-2 text-sm text-muted-foreground">
                            No students found
                          </p>
                        ) : (
                          filteredStudents.slice(0, 20).map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                              onClick={() => {
                                field.onChange([...selectedIds, s.id]);
                                setSearch("");
                              }}
                            >
                              <span className="font-mono text-muted-foreground">
                                {s.crmCode}
                              </span>
                              {s.firstName} {s.lastName}
                              <span className="ml-auto text-xs text-muted-foreground">
                                {s.status === "AWAITING_ASSIGNMENT"
                                  ? "Awaiting"
                                  : s.status === "ACTIVE"
                                    ? "Active"
                                    : s.status}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Join Date */}
            <FormField
              control={form.control}
              name="joinDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Join Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Trial Toggle */}
            <FormField
              control={form.control}
              name="isTrial"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="rounded border-input"
                    />
                    <FormLabel className="!mt-0">Trial lesson</FormLabel>
                  </div>
                  <FormDescription>
                    Trial students occupy a seat but no billing is created until
                    committed.
                  </FormDescription>
                </FormItem>
              )}
            />

            {/* Comment */}
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Optional notes..."
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || selectedIds.length === 0}
              >
                {isPending
                  ? "Adding..."
                  : `Add ${selectedIds.length || ""} Student${selectedIds.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
