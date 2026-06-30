"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  UserIcon,
  Users,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  X,
  ArrowUp,
  UserCheck,
  Plus,
  Trash2,
  Edit2,
} from "lucide-react";
import { IPO } from "@/types/ipo.types";
import { parsePANsFromText } from "../utils/pan-validator";
import { parseExcelFile, ParsedFile } from "../utils/pan-parser";
import { cn } from "@/lib/utils";
import { useProfiles, PanProfile } from "@/hooks/useProfiles";

interface CheckerTabsProps {
  onCheck: (pans: string[]) => Promise<void>;
  isLoading: boolean;
  progress: number;
  selectedIPO: IPO | null;
  /** When true, PANs are scanned across every active IPO — no IPO selection needed. */
  scanMode?: boolean;
}

export function CheckerTabs({
  onCheck,
  isLoading,
  progress,
  selectedIPO,
  scanMode = false,
}: CheckerTabsProps) {
  // A target is ready when scanning all IPOs, or a single IPO is selected.
  const noTarget = !scanMode && !selectedIPO;
  const [singlePAN, setSinglePAN] = useState("");
  const [singleError, setSingleError] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [fileError, setFileError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState("single");

  // Profile states
  const {
    profiles,
    add: addProfile,
    remove: removeProfile,
    update: updateProfile,
    hydrated: profilesHydrated,
  } = useProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isEditingProfileId, setIsEditingProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profilePansText, setProfilePansText] = useState("");
  const [profileError, setProfileError] = useState("");

  const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

  // Auto-select the first profile when loaded
  useEffect(() => {
    if (profilesHydrated && profiles.length > 0 && !selectedProfileId) {
      setSelectedProfileId(profiles[0].id);
    }
  }, [profilesHydrated, profiles, selectedProfileId]);

  const handleSingleCheck = async () => {
    const pan = singlePAN.toUpperCase().trim();
    if (!PAN_REGEX.test(pan)) {
      setSingleError("Invalid PAN format. Example: ABCDE1234F");
      return;
    }
    setSingleError("");
    await onCheck([pan]);
  };

  const handleBulkCheck = async () => {
    const { valid } = parsePANsFromText(bulkText);
    if (valid.length === 0) {
      return;
    }
    await onCheck(valid);
  };

  const handleSaveProfile = () => {
    if (!profileName.trim()) {
      setProfileError("Profile name is required");
      return;
    }
    const { valid } = parsePANsFromText(profilePansText);
    if (valid.length === 0) {
      setProfileError("At least one valid PAN is required");
      return;
    }

    if (isEditingProfileId) {
      updateProfile(isEditingProfileId, profileName, valid);
      setIsEditingProfileId(null);
    } else {
      addProfile(profileName, valid);
      setIsCreatingProfile(false);
    }

    setProfileName("");
    setProfilePansText("");
    setProfileError("");
  };

  const handleStartEditProfile = (p: PanProfile) => {
    setIsEditingProfileId(p.id);
    setProfileName(p.name);
    setProfilePansText(p.pans.join("\n"));
    setProfileError("");
  };

  const handleCheckProfile = async () => {
    const profile = profiles.find((p) => p.id === selectedProfileId);
    if (!profile || profile.pans.length === 0) return;
    await onCheck(profile.pans);
  };

  const handleFileUpload = async (file: File) => {
    setFileError("");
    setParsedFile(null);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "csv", "xls"].includes(ext ?? "")) {
      setFileError("Please upload an Excel (.xlsx, .xls) or CSV file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError("File size must be less than 5MB");
      return;
    }

    try {
      const parsed = await parseExcelFile(file);
      if (parsed.pans.length === 0) {
        setFileError("No valid PANs found in the file. Please check your file.");
        return;
      }
      setParsedFile(parsed);
    } catch {
      setFileError("Failed to parse file. Please check the format.");
    }
  };

  const bulkPANs = parsePANsFromText(bulkText);

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="single" className="gap-1 sm:gap-2 px-1 sm:px-3">
            <UserIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[11px] sm:text-xs md:text-sm">Single</span>
          </TabsTrigger>
          <TabsTrigger value="bulk" className="gap-1 sm:gap-2 px-1 sm:px-3">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[11px] sm:text-xs md:text-sm">Bulk</span>
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1 sm:gap-2 px-1 sm:px-3">
            <Upload className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[11px] sm:text-xs md:text-sm">Upload</span>
          </TabsTrigger>
          <TabsTrigger value="profiles" className="gap-1 sm:gap-2 px-1 sm:px-3">
            <UserCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[11px] sm:text-xs md:text-sm">Profiles</span>
          </TabsTrigger>
        </TabsList>

        {/* Single PAN Tab */}
        <TabsContent value="single" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="single-pan">PAN Number</Label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Input
                  id="single-pan"
                  placeholder="ABCDE1234F"
                  value={singlePAN}
                  onChange={(e) => {
                    setSinglePAN(e.target.value.toUpperCase());
                    setSingleError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSingleCheck()}
                  className={cn(
                    "font-mono text-base tracking-widest uppercase pr-10",
                    singleError && "border-destructive focus-visible:ring-destructive"
                  )}
                  maxLength={10}
                  disabled={isLoading}
                />
                {singlePAN.length === 10 && PAN_REGEX.test(singlePAN) && (
                  <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                )}
              </div>
              <Button
                onClick={handleSingleCheck}
                disabled={isLoading || noTarget || singlePAN.length < 10}
                size="default"
                className="px-6"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Check"
                )}
              </Button>
            </div>
            {singleError && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {singleError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)
            </p>
          </div>
        </TabsContent>

        {/* Bulk PAN Tab */}
        <TabsContent value="bulk" className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bulk-pans">PANs (one per line)</Label>
              {bulkPANs.valid.length > 0 && (
                <div className="flex gap-2 text-xs">
                  <Badge variant="success">{bulkPANs.valid.length} valid</Badge>
                  {bulkPANs.invalid.length > 0 && (
                    <Badge variant="danger">{bulkPANs.invalid.length} invalid</Badge>
                  )}
                  {bulkPANs.duplicates.length > 0 && (
                    <Badge variant="warning">{bulkPANs.duplicates.length} duplicates</Badge>
                  )}
                </div>
              )}
            </div>
            <Textarea
              id="bulk-pans"
              placeholder={`ABCDE1234F\nFGHIJ5678K\nLMNOP9012Q\n...`}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="min-h-[160px] font-mono text-sm"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Paste PANs separated by newlines, commas, or spaces. Duplicates are removed automatically.
            </p>
          </div>
          <Button
            onClick={handleBulkCheck}
            disabled={isLoading || noTarget || bulkPANs.valid.length === 0}
            size="default"
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking {bulkPANs.valid.length} PANs...
              </>
            ) : (
              `Check ${bulkPANs.valid.length > 0 ? bulkPANs.valid.length : ""} PANs`
            )}
          </Button>
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          {/* Drop Zone */}
          <div
            className={cn(
              "relative rounded-xl border-2 border-dashed p-4 sm:p-8 text-center transition-all",
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30",
              parsedFile && "border-emerald-500/50 bg-emerald-500/5"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFileUpload(file);
            }}
          >
            {parsedFile ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-emerald-500" />
                  <div className="text-left">
                    <p className="font-medium text-emerald-400">File loaded successfully</p>
                    <p className="text-sm text-muted-foreground">
                      {parsedFile.pans.length} valid PANs found
                      {parsedFile.detectedColumn && ` (from "${parsedFile.detectedColumn}" column)`}
                    </p>
                  </div>
                  <button
                    onClick={() => setParsedFile(null)}
                    className="ml-auto text-muted-foreground hover:text-foreground hover:bg-transparent cursor-pointer p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex justify-center gap-3 text-xs">
                  <Badge variant="success">{parsedFile.pans.length} valid</Badge>
                  {parsedFile.invalidCount > 0 && (
                    <Badge variant="danger">{parsedFile.invalidCount} invalid</Badge>
                  )}
                  {parsedFile.duplicateCount > 0 && (
                    <Badge variant="warning">{parsedFile.duplicateCount} duplicates removed</Badge>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <p className="font-medium">Drag & drop your file here</p>
                  <p className="text-sm text-muted-foreground">
                    or{" "}
                    <label className="cursor-pointer text-primary hover:underline">
                      browse to upload
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                      />
                    </label>
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Excel (.xlsx, .xls) or CSV · Max 5MB · PAN column auto-detected
                </p>
              </div>
            )}
          </div>

          {fileError && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {fileError}
            </p>
          )}

          <Button
            onClick={() => parsedFile && onCheck(parsedFile.pans)}
            disabled={isLoading || noTarget || !parsedFile}
            size="default"
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing file...
              </>
            ) : parsedFile ? (
              `Check ${parsedFile.pans.length} PANs from File`
            ) : (
              "Upload a File to Continue"
            )}
          </Button>
        </TabsContent>

        {/* Profiles Tab */}
        <TabsContent value="profiles" className="space-y-4">
          {!profilesHydrated ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading profiles...
            </div>
          ) : isCreatingProfile || isEditingProfileId ? (
            <div className="space-y-3 rounded-xl border border-border p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {isEditingProfileId ? "Edit Profile" : "Create Profile"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingProfile(false);
                    setIsEditingProfileId(null);
                    setProfileName("");
                    setProfilePansText("");
                    setProfileError("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-name">Profile Name</Label>
                <Input
                  id="profile-name"
                  placeholder="e.g. My Accounts, Family Group"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  maxLength={24}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-pans">PANs (one per line or separated by comma)</Label>
                <Textarea
                  id="profile-pans"
                  placeholder={`ABCDE1234F\nFGHIJ5678K\n...`}
                  value={profilePansText}
                  onChange={(e) => setProfilePansText(e.target.value)}
                  className="min-h-[100px] font-mono text-sm"
                  disabled={isLoading}
                />
              </div>
              {profileError && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {profileError}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCreatingProfile(false);
                    setIsEditingProfileId(null);
                    setProfileName("");
                    setProfilePansText("");
                    setProfileError("");
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveProfile} disabled={isLoading}>
                  Save
                </Button>
              </div>
            </div>
          ) : profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center bg-muted/10">
              <UserCheck className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="font-medium text-sm">No saved profiles yet</p>
              <p className="text-xs text-muted-foreground mb-4 max-w-[280px]">
                Create a profile to save a group of family PANs and check them in a single tap.
              </p>
              <Button size="sm" onClick={() => setIsCreatingProfile(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> Create Profile
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Select a profile to check:</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreatingProfile(true)}
                  className="h-7 px-2 text-xs gap-1"
                >
                  <Plus className="h-3 w-3" /> Add New
                </Button>
              </div>
              <div className="grid gap-2 max-h-[220px] overflow-y-auto pr-1 scrollbar">
                {profiles.map((p) => {
                  const isSelected = selectedProfileId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProfileId(p.id)}
                      className={cn(
                        "flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:border-primary/50 hover:bg-muted/30"
                      )}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-semibold truncate text-foreground">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                          {p.pans.length} PAN{p.pans.length === 1 ? "" : "s"}: {p.pans.join(", ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleStartEditProfile(p)}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted/50 transition-colors"
                          title="Edit profile"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeProfile(p.id)}
                          className="p-1.5 text-muted-foreground hover:text-rose-400 rounded hover:bg-muted/50 transition-colors"
                          title="Delete profile"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedProfileId && (
                <Button
                  onClick={handleCheckProfile}
                  disabled={isLoading || noTarget}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking profile...
                    </>
                  ) : (
                    (() => {
                      const profile = profiles.find((p) => p.id === selectedProfileId);
                      return `Check ${profile ? profile.name : ""} (${
                        profile ? profile.pans.length : 0
                      } PANs)`;
                    })()
                  )}
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Progress Bar */}
      {isLoading && progress > 0 && (
        <div className="space-y-2">
          <Progress value={progress} className="h-1" />
          <p className="text-xs text-center text-muted-foreground font-medium">
            Checking allotment status... {Math.round(progress)}%
          </p>
        </div>
      )}

      {/* Notice */}
      {noTarget && (
        <p className="text-xs text-center text-muted-foreground">
          <ArrowUp className="inline h-3 w-3" /> Please select an IPO above before checking
        </p>
      )}
      {scanMode && (
        <p className="text-xs text-center text-muted-foreground">
          PANs will be checked across <span className="font-medium text-foreground">all active IPOs</span>.
        </p>
      )}
    </div>
  );
}
