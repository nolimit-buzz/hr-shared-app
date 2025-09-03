"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { handleApiError } from '@/app/lib/errorHandler';
import {
  Box,
  Container,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Paper,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Pagination,
  Skeleton,
  FormControl,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";
import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import CandidateListSection from "@/app/dashboard/components/dashboard/CandidatesListSection";
import { useTheme } from "@mui/material/styles";
import { PHASE_OPTIONS } from "@/app/constants/phaseOptions";
import { styled } from "@mui/material/styles";
import { getSkillsForRole, Skill } from "@/app/lib/skills";
import JobDescription from "@/app/dashboard/components/JobDescription";
import FilterSection from "@/app/dashboard/components/FilterSection";
import Notification from '@/app/dashboard/components/Notification';
import MobileCandidateGrid from '@/app/dashboard/components/MobileCandidateGrid';
import EmptyState from '@/app/dashboard/components/EmptyState';
import {
  JobDetails,
  FilterState,
  CandidateResponse,
  SkillColor,
  StageType,
  Assessment,
  PhaseOption,
} from '@/app/dashboard/types/candidate';
import MobileStageDropdown from '@/app/dashboard/components/MobileStageDropdown';
import CandidateSkeletonLoader from '@/app/dashboard/components/CandidateSkeletonLoader';
import AssessmentIcon from '@/app/dashboard/components/AssessmentIcon';
import Link from "next/link";

// Remove unused styled components
const PrimaryButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  gap: "5px",
  padding: "10px 20px",
  fontSize: theme.typography.pxToRem(16),
  color: theme.palette.secondary.light,
  fontWeight: theme.typography.fontWeightMedium,
  height: "52px",
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    backgroundColor: "#6666E6",
    transform: "translateY(-1px)",
    boxShadow: "0 4px 12px rgba(68, 68, 226, 0.15)",
  },
}));

export default function Home() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  // Get the view parameter from URL
  const viewParam = searchParams.get('view');

  // Set initial primary tab value based on view parameter
  const [primaryTabValue, setPrimaryTabValue] = useState(() => {
    return viewParam === '1' ? 1 : 0;
  });
  const [subTabValue, setSubTabValue] = useState(0);
  const [selectedAssessmentType, setSelectedAssessmentType] = useState(0);
  const [quickActionsAnchor, setQuickActionsAnchor] =
    useState<HTMLElement | null>(null);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [stageTotals, setStageTotals] = useState({
    new: 0,
    skill_assessment: 0,
    interviews: 0,
    acceptance: 0,
    archived: 0,
  });
  const [filters, setFilters] = useState<FilterState>({
    yearsOfExperience: "",
    salaryMin: "",
    salaryMax: "",
    requiredSkills: [],
    availability: "",
    trial: "",
  });
  const [filteredCandidates, setFilteredCandidates] =
    useState<CandidateResponse>({ applications: [] });
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateResponse>({
    applications: [],
  });
  const [selectedEntries, setSelectedEntries] = useState<number[]>([]);
  const [isMovingStage, setIsMovingStage] = useState("");
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<HTMLElement | null>(
    null
  );
  const [dynamicPhaseOptions, setDynamicPhaseOptions] = useState<Record<StageType, PhaseOption[]>>(PHASE_OPTIONS);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Simplified getJobId function
  const getJobId = useCallback((): string => {
    return params["job_id"] as string;
  }, [params]);
  const fetchJobDetails = async () => {
    if (!params["job_id"]) return; // Guard against undefined job_id

    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("jwt");
      const jobId = params["job_id"] as string;
      const response = await fetch(
        `https://app.elevatehr.ai/wp-json/elevatehr/v1/jobs/${jobId}?sort_by=match_score&sort_order=desc`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      handleApiError(response);

      const data = await response.json();
      // console.log("Job details received:", data);
      setJobDetails(data);
      setLoading(false);
      // Set stage totals from job details
      if (data.stage_counts) {
        setStageTotals(data.stage_counts);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to fetch job details");
      }
      setLoading(false);
    }
  };
  // Fetch job details
  useEffect(() => {

    fetchJobDetails();
  }, [params["job_id"]]); // Direct dependency on params["job_id"]

  // Fetch candidates
  const fetchCandidates = useCallback(async () => {
    if (!params["job_id"]) return; // Guard against undefined job_id

    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("jwt");
      const jobId = params["job_id"] as string;
      const url = new URL(`https://app.elevatehr.ai/wp-json/elevatehr/v1/jobs/${jobId}/applications`);
      // For "All" tab (index 0), do not include stage filter
      if (subTabValue !== 0) {
        const stage = getStageValue(subTabValue);
        url.searchParams.append('stage', stage);
      }
      url.searchParams.append('page', page.toString());
      url.searchParams.append('per_page', perPage.toString());

      // Add logging for debugging
      // console.log('Selected Assessment Type:', selectedAssessmentType);
      // console.log('Assessments:', assessments);

      if (subTabValue !== 0 && getStageValue(subTabValue) === 'skill_assessment' && selectedAssessmentType > 0) {
        // Subtract 1 because index 0 is "All" tab
        const assessmentType = assessments[selectedAssessmentType - 1]?.type;
        // console.log('Assessment Type to be added:', assessmentType);
        if (assessmentType) {
          url.searchParams.append('assessment_type', assessmentType);
        }
      }

      // console.log('Final URL:', url.toString());
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      handleApiError(response);

      const data = await response.json();
      setCandidates(data);
      setFilteredCandidates(data);
      setTotalPages(data.total_pages);
      setTotalItems(data.total);
      setLoading(false);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to fetch candidates");
      }
      setLoading(false);
    }
  }, [params["job_id"], subTabValue, selectedAssessmentType, page, perPage, assessments]);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  useEffect(() => {
    if (primaryTabValue === 0) {
      fetchCandidates();
    }
  }, [fetchCandidates, primaryTabValue]);

  useEffect(() => {
    // console.log("Job details received:", jobDetails);
    const loadSkills = async () => {
      if (jobDetails) {
        const skills = await getSkillsForRole(
          jobDetails.title,
          jobDetails.about_role
        );
        setAvailableSkills(skills);
      }
    };

    if (jobDetails) {
      loadSkills();
    }
  }, [jobDetails]);

  useEffect(() => {
    // Adjust the key if your localStorage user profile uses a different key
    const userProfile = localStorage.getItem("userProfile");
    if (userProfile) {
      try {
        const parsed = JSON.parse(userProfile);
        setCompanyId(parsed.companyInfo.company_id || parsed.user_id || null);
      } catch {
        setCompanyId(null);
      }
    }
  }, []);

  const getStageValue = (tabValue: number): StageType => {
    switch (tabValue) {
      case 1:
        return "new";
      case 2:
        return "skill_assessment";
      case 3:
        return "interviews";
      case 4:
        return "acceptance";
      case 5:
        return "archived";
      default:
        return "new";
    }
  };

  const handleFilterChange = (
    filterName: keyof FilterState,
    value: string | string[]
  ) => {
    setFilters((prev) => ({
      ...prev,
      [filterName]: value,
    }));
  };

  const applyFilters = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("jwt");
      const jobId = getJobId();
      const stage = subTabValue === 0 ? "new" : getStageValue(subTabValue);

      // Build query parameters from filters
      const queryParams = new URLSearchParams();
      if (filters.yearsOfExperience) {
        const [minYears, maxYears] = filters.yearsOfExperience
          .split("-")
          .map((num) => parseInt(num));
        if (minYears && !maxYears) {
          queryParams.append("min_experience", minYears.toString());
        }
        if (minYears && maxYears) {
          queryParams.append(
            "experience_range",
            minYears.toString() + "-" + maxYears.toString()
          );
        }
      }
      if (filters.salaryMin)
        queryParams.append("min_salary", filters.salaryMin);
      if (filters.salaryMax)
        queryParams.append("max_salary", filters.salaryMax);
      if (filters.requiredSkills.length > 0) {
        queryParams.append("skills", filters.requiredSkills.join(","));
      }
      if (filters.availability)
        queryParams.append("availability", filters.availability);
      if (filters.trial) queryParams.append("trial", filters.trial);
      queryParams.append("stage", stage);

      const response = await fetch(
        `https://app.elevatehr.ai/wp-json/elevatehr/v1/jobs/${jobId}/applications?${queryParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      handleApiError(response);

      const data = await response.json();
      setFilteredCandidates(data);
      setCandidates(data); // Update the base candidates list as well
    } catch (error: unknown) {
      console.error("Error applying filters:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unexpected error occurred while applying filters");
      }
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      yearsOfExperience: "",
      salaryMin: "",
      salaryMax: "",
      requiredSkills: [],
      availability: "",
      trial: "",
    });
    fetchCandidates();
  };

  const handlePrimaryTabChange = (
    _event: React.SyntheticEvent,
    newValue: number
  ) => {
    setPrimaryTabValue(newValue);
  };

  const handleSubTabChange = (
    _event: React.SyntheticEvent,
    newValue: number
  ) => {
    setSelectedEntries([]);
    setSubTabValue(newValue);
  };

  const handleQuickActionsOpen = (event: React.MouseEvent<HTMLElement>) => {
    setQuickActionsAnchor(event.currentTarget);
  };

  const handleQuickActionsClose = () => {
    setQuickActionsAnchor(null);
  };

  const getSkillChipColor = (skill: string): SkillColor => {
    const skillColors = [
      { bg: "rgba(114, 74, 59, 0.15)", color: "#724A3B" },
      { bg: "rgba(43, 101, 110, 0.15)", color: "#2B656E" },
      { bg: "rgba(118, 50, 95, 0.15)", color: "#76325F" },
      { bg: "rgba(59, 95, 158, 0.15)", color: "#3B5F9E" },
    ];

    // Use modulo to cycle through colors if there are more skills than colors
    const colorIndex =
      Math.abs(
        skill.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
      ) % skillColors.length;
    return skillColors[colorIndex];
  };

  const handleSelectCandidate = (id: number) => {
    setSelectedEntries((prev) => {
      if (prev.includes(id)) {
        return prev.filter((entryId) => entryId !== id);
      } else {
        return [...prev, id];
      }
    });
  };
  const handleCardClick = (
    candidateId: number,
    event: React.MouseEvent<HTMLElement>
  ) => {
    // Prevent redirection if clicking on checkbox or quick actions button
    if (
      (event.target as HTMLElement).closest(".checkbox-container") ||
      (event.target as HTMLElement).closest(".quick-actions-button")
    ) {
      return;
    }

    // Get the job_id from the URL
    const pathParts = window.location.pathname.split("/");
    const jobId = pathParts[pathParts.length - 2];

    // Navigate to the applicant details page
    router.push(`/dashboard/job-posting/${jobId}/submissions/${candidateId}`);
  };

  const handleUpdateStages = async ({
    stage,
    entries = selectedEntries,
    assessmentType
  }: {
    stage: StageType;
    entries?: number[];
    assessmentType?: string;
  }) => {
    if (!entries?.length) return;

    setIsMovingStage(stage);
    try {
      const token = localStorage.getItem("jwt");
      if (!token) {
        throw new Error("No authentication token found");
      }

      // if (stage.startsWith('assessment_')) {
      //   console.log("running starts with assessment")
      //   // Handle assessment sending
      //   const assessmentId = dynamicPhaseOptions[getStageValue(subTabValue)]
      //     .find(option => option.action === stage)?.id;

      //   if (!assessmentId) {
      //     throw new Error('Assessment ID not found');
      //   }

      //   const response = await fetch(
      //     'https://app.elevatehr.ai/wp-json/elevatehr/v1/applications/send-job-assessment',
      //     {
      //       method: 'POST',
      //       headers: {
      //         'Content-Type': 'application/json',
      //         Authorization: `Bearer ${token}`,
      //       },
      //       body: JSON.stringify({
      //         application_ids: entries,
      //         assessment_id: assessmentId
      //       })
      //     }
      //   );

      //   handleApiError(response);

      //   handleNotification('Assessment sent successfully', 'success');
      // } else {
        console.log("running regular stage update")
        // Handle regular stage update
        const response = await fetch(
          "https://app.elevatehr.ai/wp-json/elevatehr/v1/applications/move-stage",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              entries: entries,
              stage: stage,
            }),
          }
        );

        handleApiError(response);


        handleNotification(
          `Successfully moved ${entries.length} candidate${entries.length > 1 ? "s" : ""
          } to ${stage.replace("_", " ")}`,
          "success"
        );
      // }
      console.log("fetching job details")
      fetchJobDetails();
      // Refresh the candidates list
      fetchCandidates();
    } catch (error) {
      console.error("Error updating stage:", error);
      handleNotification(
        error instanceof Error ? error.message : "Failed to update stage",
        "error"
      );
    } finally {
      setIsMovingStage("");
      setSelectedEntries([]);
    }
  };

  const handleCloseNotification = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setNotification(prev => ({ ...prev, open: false }));
  };

  const handleNotification = (message: string, severity: 'success' | 'error') => {
    setNotification({
      open: true,
      message,
      severity
    });
  };

  const hasActiveFilters = () => {
    return (
      filters.yearsOfExperience !== "" ||
      filters.salaryMin !== "" ||
      filters.salaryMax !== "" ||
      filters.requiredSkills.length > 0 ||
      filters.availability !== "" ||
      filters.trial !== ""
    );
  };

  const handleError = (error: unknown) => {
    if (error instanceof Error) {
      setError(error.message);
    } else {
      setError("An unexpected error occurred");
    }
  };

  // Bulk email editor (client-only) with stable reference
  const ReactQuill = React.useMemo(() => dynamic(() => import("react-quill"), { ssr: false }), []);
  const quillModules = React.useMemo(() => ({
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean']
    ],
  }), []);
  const quillFormats = React.useMemo(() => (
    [
      'header',
      'bold', 'italic', 'underline', 'strike',
      'list', 'bullet',
      'link'
    ]
  ), []);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailContent, setEmailContent] = useState("");
  const [emailError, setEmailError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<any | null>(null);

  const mapActionToTemplateKey = (action: string): string | null => {
    switch (action) {
      case "skill_assessment":
        return "skill_assessment";
      case "technical_assessment":
        return "technical_assessment";
      case "online_assessment_1":
        return "online_assessment_1";
      case "online_assessment_2":
        return "online_assessment_2";
      case "interviews":
        return "interviews";
      case "acceptance":
        return "acceptance";
      case "archived":
        return "archived";
      default:
        return null;
    }
  };

  const openEmailModalForAction = async (action: string) => {
    try {
      setPendingAction(action);
      setEmailLoading(true);
      setEmailError("");
      setEmailContent("");
      // Use cached templates if available; otherwise fetch once and cache
      let data = emailTemplates;
      if (!data) {
        const token = localStorage.getItem("jwt");
        if (!token) throw new Error("Authentication token not found");
        const response = await fetch(
          "https://app.elevatehr.ai/wp-json/elevatehr/v1/email-templates",
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            cache: "no-store",
          }
        );
        if (!response.ok) {
          throw new Error("Failed to fetch email templates");
        }
        data = await response.json();
        setEmailTemplates(data);
      }
      console.log("data", data, action);
      const key = mapActionToTemplateKey(action);
      const content = key && data?.templates?.[key]?.content ? data.templates[key].content : "";
      setEmailContent(content);
      setEmailModalOpen(true);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to load templates");
      setNotification({ open: true, message: emailError || "Failed to load templates", severity: "error" });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSendBulkEmailAndMoveStage = async () => {
    if (!pendingAction || !selectedEntries || selectedEntries.length === 0) return;
    try {
      setEmailLoading(true);
      const token = localStorage.getItem("jwt");
      if (!token) throw new Error("Authentication token not found");
      const response = await fetch(
        "https://app.elevatehr.ai/wp-json/elevatehr/v1/applications/move-stage",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            entries: selectedEntries,
            stage: pendingAction,
            custom_email_template: emailContent,
          }),
        }
      );
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Failed to update stage with email");
      }
      setNotification({ open: true, message: `Email sent and ${selectedEntries.length} candidate(s) moved to '${pendingAction.replace("_", " ")}'`, severity: "success" });
      setEmailModalOpen(false);
      setPendingAction(null);
      setSelectedEntries([]);
      // Refresh list
      fetchJobDetails();
      fetchCandidates();
    } catch (err) {
      setNotification({ open: true, message: err instanceof Error ? err.message : "Failed to send email", severity: "error" });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleCloseResponses = async () => {
    try {
      const token = localStorage.getItem("jwt");
      if (!token) throw new Error("Authentication token not found");

      const jobId = getJobId();
      const newStatus = jobDetails?.status === "close" ? "active" : "close";

      const response = await fetch(
        `https://app.elevatehr.ai/wp-json/elevatehr/v1/jobs/${jobId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...jobDetails,
            status: newStatus,
          }),
        }
      );

      handleApiError(response);

      // Show success notification
      setNotification({
        open: true,
        message: newStatus === "close"
          ? "Job posting closed successfully"
          : "Job posting reopened successfully",
        severity: "success"
      });

      // Refetch job details and candidates if reopening
      if (newStatus === "active") {
        // Refetch job details
        const jobDetailsResponse = await fetch(
          `https://app.elevatehr.ai/wp-json/elevatehr/v1/jobs/${jobId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            cache: "no-store",
          }
        );

        handleApiError(jobDetailsResponse);

        const jobDetailsData = await jobDetailsResponse.json();
        setJobDetails(jobDetailsData);
        if (jobDetailsData.stage_counts) {
          setStageTotals(jobDetailsData.stage_counts);
        }

        // Refetch candidates for current stage
        const currentStage = getStageValue(subTabValue);
        const candidatesResponse = await fetch(
          `https://app.elevatehr.ai/wp-json/elevatehr/v1/jobs/${jobId}/applications?stage=${currentStage}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        handleApiError(candidatesResponse);

        const candidatesData = await candidatesResponse.json();
        setCandidates(candidatesData);
        setFilteredCandidates(candidatesData);
      } else {
        // Redirect to dashboard if closing
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      }
    } catch (error) {
      if (error instanceof Error) {
        setNotification({
          open: true,
          message: error.message,
          severity: "error"
        });
      } else {
        setNotification({
          open: true,
          message: "An unexpected error occurred while updating the job status",
          severity: "error"
        });
      }
    }
  };

  const fetchAssessments = async () => {
    setLoadingAssessments(true);
    try {
      const token = localStorage.getItem("jwt");
      const jobId = getJobId();
      const response = await fetch(
        `https://app.elevatehr.ai/wp-json/elevatehr/v1/get-job-assessment?job_id=${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch assessments");
      }

      const data = await response.json();
      // console.log('Raw assessment data:', data);
      if (data.status === "success" && Array.isArray(data.assessments)) {
        setAssessments(data.assessments);
        // console.log('Assessments set:', data.assessments);

        // Update dynamic phase options with assessment options
        const assessmentOptions = data.assessments.map((assessment: Assessment) => ({
          label: `Send ${assessment.type.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ')}`,
          icon: AssessmentIcon,
          action: assessment.type,
          id: assessment.id
        }));

        // console.log('Assessment Options:', assessmentOptions);
        // console.log('Original PHASE_OPTIONS:', PHASE_OPTIONS);

        setDynamicPhaseOptions(prev => {
          const newOptions = {
            ...prev,
            skill_assessment: [
              ...PHASE_OPTIONS.skill_assessment,
              ...assessmentOptions
            ]
          };
          // console.log('New Dynamic Phase Options:', newOptions);
          return newOptions;
        });
      } else {
        setAssessments([]);
        // Reset to original phase options if no assessments
        setDynamicPhaseOptions(PHASE_OPTIONS);
      }
    } catch (error) {
      console.error("Error fetching assessments:", error);
      setAssessments([]);
      // Reset to original phase options on error
      setDynamicPhaseOptions(PHASE_OPTIONS);
    } finally {
      setLoadingAssessments(false);
    }
  };

  useEffect(() => {
    if (subTabValue === 2) {
      fetchAssessments();
    }
  }, [subTabValue]);

  const handleFilterMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setFilterMenuAnchor(event.currentTarget);
  };

  const handleFilterMenuClose = () => {
    setFilterMenuAnchor(null);
  };

  // Add skeleton loader for job description
  const JobDescriptionSkeleton = () => (
    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', width: '100%' }}>
      {/* Left Sidebar Skeleton */}
      <Box
        sx={{
          width: { xs: '100%', md: 280 },
          minWidth: 220,
          bgcolor: '#fff', // Changed to white
          borderRadius: '16px',
          p: 3,
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          height: 240,
          overflow: 'hidden',
        }}
      >
        <Skeleton variant="text" width="80%" height={32} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" width={80} height={28} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" width={60} height={28} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" width={120} height={28} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" width="60%" height={24} sx={{ mt: 2 }} />
      </Box>

      {/* Main Job Details Skeleton */}
      <Box
        sx={{
          flex: 1,
          bgcolor: '#fff',
          borderRadius: '16px',
          boxShadow: '0px 4px 24px rgba(17, 17, 17, 0.06)',
          p: 4,
          minHeight: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        <Skeleton variant="circular" width={48} height={48} sx={{ mb: 2 }} />
        <Skeleton variant="text" width="40%" height={32} />
        <Skeleton variant="rectangular" width="100%" height={40} sx={{ mb: 2, borderRadius: 1 }} />
        <Skeleton variant="text" width="30%" height={28} sx={{ mb: 1 }} />
        <Skeleton variant="rectangular" width="100%" height={60} sx={{ mb: 2, borderRadius: 1 }} />
        <Skeleton variant="text" width="35%" height={28} sx={{ mb: 1 }} />
        <Skeleton variant="rectangular" width="100%" height={80} sx={{ mb: 2, borderRadius: 1 }} />
        <Skeleton variant="text" width="25%" height={28} sx={{ mb: 1 }} />
        <Skeleton variant="rectangular" width="100%" height={60} sx={{ borderRadius: 1 }} />
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        bgcolor: "#F5F7FA",
      }}
    >
      <Container maxWidth="xl" sx={{ flexGrow: 1, py: 3 }}>
        <Notification
          open={notification.open}
          message={notification.message}
          severity={notification.severity}
          onClose={handleCloseNotification}
        />
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <IconButton
            sx={{
              mr: 1,
              padding: 0,
              display: { xs: 'flex', sm: 'none' }
            }}
            aria-label="back"
            onClick={() => router.back()}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h5"
            sx={{
              fontSize: { xs: "15px", sm: "18px" },
              color: "grey.200",
              display: { xs: 'block', sm: 'none' }
            }}
          >
            Back
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              sx={{
                mr: 1,
                display: { xs: "none", sm: "flex" },
              }}
              aria-label="back"
              onClick={() => router.back()}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography
              className="job-title"
              variant="h5"
              sx={{
                fontSize: { xs: "18px", sm: "24px" },
                fontWeight: 600,
                color: "rgba(17, 17, 17, 0.84)",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              {getJobId() ? (
                <span className="public-link" style={{ display: "inline-flex", alignItems: "center" }}>
                  <span className="job-title">{jobDetails?.title}</span>
                  <Link
                    href={`/job-openings/${getJobId()}${companyId ? `?company_id=${companyId}` : ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", marginLeft: 8 }}
                    title="View public job posting"
                  >
                    <svg style={{ transform: 'rotate(45deg)' }} width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18.0701 10.32C17.8801 10.32 17.6901 10.25 17.5401 10.1L12.0001 4.56L6.46012 10.1C6.17012 10.39 5.69012 10.39 5.40012 10.1C5.11012 9.81 5.11012 9.33 5.40012 9.04L11.4701 2.97C11.7601 2.68 12.2401 2.68 12.5301 2.97L18.6001 9.04C18.8901 9.33 18.8901 9.81 18.6001 10.1C18.4601 10.25 18.2601 10.32 18.0701 10.32Z" fill="#292D32" />
                      <path d="M12 21.25C11.59 21.25 11.25 20.91 11.25 20.5V3.67C11.25 3.26 11.59 2.92 12 2.92C12.41 2.92 12.75 3.26 12.75 3.67V20.5C12.75 20.91 12.41 21.25 12 21.25Z" fill="#292D32" />
                    </svg>
                  </Link>
                </span>
              ) : (
                jobDetails?.title
              )}
            </Typography>
          </Box>
          <PrimaryButton
            variant="contained"
            onClick={handleCloseResponses}
            sx={{
              height: { xs: "36px", sm: "52px" },
              "& .MuiButton-startIcon": {
                marginRight: { xs: "4px", sm: "8px" },
              },
            }}
          >
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              {jobDetails?.status === "close"
                ? "Reopen Job Posting"
                : "Close Responses for this Job"}
            </Box>
            <Box sx={{ display: { xs: "block", sm: "none" } }}>
              {jobDetails?.status === "close" ? "Reopen" : "Close Responses"}
            </Box>
          </PrimaryButton>
        </Box>

        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
          <Tabs
            value={primaryTabValue}
            onChange={(_event: React.SyntheticEvent, newValue: number) =>
              setPrimaryTabValue(newValue)
            }
            aria-label="primary tabs"
            sx={{
              minHeight: "auto",
              "& .MuiTabs-indicator": {
                backgroundColor: "#4444E2",
              },
              "& .MuiTab-root": {
                transition: "all 0.2s ease-in-out",
                "&:hover": {
                  color: theme.palette.secondary.main,
                },
              },
            }}
          >
            <Tab
              label="Applications"
              sx={{
                textTransform: "none",
                fontWeight: primaryTabValue === 0 ? "bold" : "normal",
                color:
                  primaryTabValue === 0
                    ? theme.palette.secondary.main
                    : theme.palette.grey[100],
              }}
            />
            <Tab
              label="Job description"
              sx={{
                textTransform: "none",
                fontWeight: primaryTabValue === 1 ? "bold" : "normal",
                color:
                  primaryTabValue === 1
                    ? theme.palette.secondary.main
                    : theme.palette.grey[100],
              }}
            />
          </Tabs>
        </Box>

        {primaryTabValue === 0 ? (
          <Stack direction="row" maxWidth={'100%'} gap={3}>
            <Box sx={{ display: { xs: "none", lg: "block" }, width: 308 }}>
              <FilterSection
                filters={filters}
                availableSkills={availableSkills}
                onFilterChange={handleFilterChange}
                onClearFilters={clearFilters}
                onApplyFilters={applyFilters}
                hasActiveFilters={hasActiveFilters}
                sx={{ bgcolor: '#FFFFFF', borderRadius: 2, p: 2 }}
              />
            </Box>

            {/* Mobile Filter Dialog */}
            <FilterSection
              filters={filters}
              availableSkills={availableSkills}
              onFilterChange={handleFilterChange}
              onClearFilters={clearFilters}
              onApplyFilters={applyFilters}
              hasActiveFilters={hasActiveFilters}
              isMobile
              open={Boolean(filterMenuAnchor)}
              onClose={handleFilterMenuClose}
              sx={{ bgcolor: '#FFFFFF', p: 2 }}
            />
            <Box sx={{ flex: 1, width: '80%', py:0, bg:"#ffffff" }}>
              {/* Your existing tabs */}
              <Box
                sx={{
                  borderBottom: 1,
                  borderColor: "divider",
                  // mb: 3,
                  backgroundColor: "#ffffff !important",
                  borderRadius: "10px",
                  paddingX: "20px",
                }}
              >
                {/* Tabs for large screens */}
                <Box sx={{ display: { xs: "none", lg: "block" } }}>
                  <Tabs
                    value={subTabValue}
                    onChange={(
                      _event: React.SyntheticEvent,
                      newValue: number
                    ) => {
                      handleSubTabChange(_event, newValue);
                    }}
                    indicatorColor="secondary"
                    variant="scrollable"
                    scrollButtons="auto"
                    aria-label="submission tabs"
                    sx={{
                      // width: "100%",
                      alignItems: "center",
                      "& .MuiTab-root": {
                        transition: "all 0.2s ease-in-out",
                        "&:hover": {
                          color: theme.palette.secondary.main,
                        },
                      },
                    }}
                  >
                    <Tab
                      label={
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <span>All</span>
                          <Chip
                            label={stageTotals.new + stageTotals.skill_assessment + stageTotals.interviews + stageTotals.acceptance + stageTotals.archived}
                            size="small"
                            sx={{
                              bgcolor: theme.palette.secondary.main,
                              color: "white",
                              height: "20px",
                              "& .MuiChip-label": {
                                px: 1,
                                fontSize: "12px",
                                fontWeight: 500,
                              },
                            }}
                          />
                        </Box>
                      }
                      sx={{
                        textTransform: "none",
                        color:
                          subTabValue === 0
                            ? theme.palette.grey[100]
                            : theme.palette.grey[200],
                        flex: 1,
                      }}
                    />
                    <Tab
                      label={
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <span>Application Review</span>
                          <Chip
                            label={stageTotals.new}
                            size="small"
                            sx={{
                              bgcolor: theme.palette.secondary.main,
                              color: "white",
                              height: "20px",
                              "& .MuiChip-label": {
                                px: 1,
                                fontSize: "12px",
                                fontWeight: 500,
                              },
                            }}
                          />
                        </Box>
                      }
                      sx={{
                        textTransform: "none",
                        color:
                          subTabValue === 1
                            ? theme.palette.grey[100]
                            : theme.palette.grey[200],
                        flex: 1,
                      }}
                    />
                    <Tab
                      label={
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <span>Skill assessment</span>
                          <Chip
                            label={stageTotals.skill_assessment}
                            size="small"
                            sx={{
                              bgcolor: theme.palette.secondary.main,
                              color: "white",
                              height: "20px",
                              "& .MuiChip-label": {
                                px: 1,
                                fontSize: "12px",
                                fontWeight: 500,
                              },
                            }}
                          />
                        </Box>
                      }
                      sx={{
                        textTransform: "none",
                        color:
                          subTabValue === 2
                            ? theme.palette.grey[100]
                            : theme.palette.grey[200],
                        flex: 1,
                      }}
                    />
                    <Tab
                      label={
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <span>Interviews</span>
                          <Chip
                            label={stageTotals.interviews}
                            size="small"
                            sx={{
                              bgcolor: theme.palette.secondary.main,
                              color: "white",
                              height: "20px",
                              "& .MuiChip-label": {
                                px: 1,
                                fontSize: "12px",
                                fontWeight: 500,
                              },
                            }}
                          />
                        </Box>
                      }
                      sx={{
                        textTransform: "none",
                        color:
                          subTabValue === 3
                            ? theme.palette.grey[100]
                            : theme.palette.grey[200],
                        flex: 1,
                      }}
                    />
                    <Tab
                      label={
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <span>Acceptance</span>
                          <Chip
                            label={stageTotals.acceptance}
                            size="small"
                            sx={{
                              bgcolor: theme.palette.secondary.main,
                              color: "white",
                              height: "20px",
                              "& .MuiChip-label": {
                                px: 1,
                                fontSize: "12px",
                                fontWeight: 500,
                              },
                            }}
                          />
                        </Box>
                      }
                      sx={{
                        textTransform: "none",
                        color:
                          subTabValue === 4
                            ? theme.palette.grey[100]
                            : theme.palette.grey[200],
                        flex: 1,
                      }}
                    />
                    <Tab
                      label={
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <span>Archived</span>
                          <Chip
                            label={stageTotals.archived}
                            size="small"
                            sx={{
                              bgcolor: theme.palette.secondary.main,
                              color: "white",
                              height: "20px",
                              "& .MuiChip-label": {
                                px: 1,
                                fontSize: "12px",
                                fontWeight: 500,
                              },
                            }}
                          />
                        </Box>
                      }
                      sx={{
                        textTransform: "none",
                        color:
                          subTabValue === 5
                            ? theme.palette.grey[100]
                            : theme.palette.grey[200],
                        flex: 1,
                      }}
                    />
                  </Tabs>
                </Box>

                {/* Mobile Dropdown */}
                <MobileStageDropdown
                  subTabValue={subTabValue}
                  stageTotals={stageTotals}
                  onTabChange={handleSubTabChange}
                  onFilterClick={handleFilterMenuOpen}
                />
              </Box>
              <Paper
                elevation={0}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  bgcolor: "transparent",
                  borderRadius: 2,
                  position: "relative",
                  height: `calc(100vh - 200px)`,
                }}
              >
                {/* Actions bar inside Paper, before candidates list */}
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    alignItems: "center",
                    justifyContent: "space-between",
                    py: 2,

                  }}
                >
                  {/* Select All control */}
                  {filteredCandidates?.applications?.length > 1 && <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        // borderBottom: {
                        //   xs: "none",
                        //   lg: "1px solid rgba(0, 0, 0, 0.12)",
                        // },
                        display: 'flex',
                        justifyContent: 'flex-start',
                        alignItems: 'center',
                        // py: 0.5,

                      }}
                    >
                      {(() => {
                        const allVisibleIds = filteredCandidates?.applications?.map((c) => c.id) || [];
                        const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedEntries?.includes(id));
                        return (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              if (allSelected) {
                                setSelectedEntries([]);
                              } else {
                                setSelectedEntries(allVisibleIds);
                              }
                            }}
                            sx={{
                              width: "max-content",
                              flexWrap: "nowrap",
                              py: 1,
                              px: 1.5,
                              color: 'rgba(17, 17, 17, 0.84)',
                              borderColor: 'rgba(17, 17, 17, 0.12)',
                              '&:hover': {
                                borderColor: 'rgba(17, 17, 17, 0.24)',
                              },
                            }}
                          >
                            {allSelected ? 'Clear selection' : 'Select all candidates'}
                          </Button>
                        );
                      })()}
                    </Box>
                    {selectedEntries?.length > 0 &&
                      subTabValue !== 4 && ( // Hide for acceptance phase
                        <>

                          <Box
                            sx={{
                              width: "max-content",
                              flexWrap: "nowrap", display: "flex", alignItems: "center", gap: 1, backgroundColor: "#ffffff", borderRadius: "1000px", px: 1.5, py: 0.5, border: "1px solid rgba(0, 0, 0, 0.12)"
                            }}
                          >
                            <Typography
                              variant="body1"
                              color={theme.palette.grey[100]}
                            >
                              {selectedEntries?.length} candidates selected
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => setSelectedEntries([])}
                              sx={{ ml: 1 }}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Box>


                        </>
                      )}
                  </Box>}
                  {selectedEntries?.length > 0 &&
                    subTabValue !== 4 && (
                      <Box sx={{ display: "flex", gap: 2 }}>
                        {(() => {
                          // console.log('Current stage:', getStageValue(subTabValue));
                          // console.log('Available options:', dynamicPhaseOptions[getStageValue(subTabValue)]);
                          return null;
                        })()}
                        {dynamicPhaseOptions[getStageValue(subTabValue)]?.map(
                          (option) => {
                            // console.log('Rendering option:', option);
                            return (
                              <Button
                                key={option.action}
                                variant="outlined"
                                startIcon={
                                  isMovingStage === option.action ? (
                                    <CircularProgress size={20} />
                                  ) : (
                                    <option.icon />
                                  )
                                }
                                onClick={ () => {
                                  // const emailStages = ["interviews", "acceptance", "archived"];
                                  // if (emailStages.includes(option.action)) {
                                   openEmailModalForAction(option.action);
                                  // } else {
                                  //   handleUpdateStages({
                                  //     stage: option.action as StageType,
                                  //     assessmentType: option.action.startsWith('assessment_')
                                  //       ? option.action.replace('assessment_', '')
                                  //       : undefined
                                  //   });
                                  // }
                                }}
                                disabled={isMovingStage.length > 0}
                                sx={{
                                  color: "rgba(17, 17, 17, 0.84)",
                                  borderColor: "rgba(17, 17, 17, 0.12)",
                                  "&:hover": {
                                    borderColor: "rgba(17, 17, 17, 0.24)",
                                  },
                                  "&.Mui-disabled": {
                                    backgroundColor: "rgba(0, 0, 0, 0.12)",
                                    color: "rgba(0, 0, 0, 0.26)",
                                  },
                                }}
                              >
                                {isMovingStage === option.action ? "Moving..." : option.label}
                              </Button>
                            );
                          }
                        )}
                      </Box>
                    )}
                  {/* Rows-per-page moved below, just before candidates listing */}
                </Box>

                {/* Assessment Tabs */}
                {subTabValue === 2 && (
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    {(() => {
                      // console.log('Rendering assessment tabs with:', { selectedAssessmentType, assessments });
                      return null;
                    })()}
                    <Tabs
                      value={selectedAssessmentType}
                      onChange={(_, newValue) => {
                        // console.log('Tab changed to:', newValue);
                        setSelectedAssessmentType(newValue);
                      }}
                      aria-label="skill assessment tabs"
                      sx={{
                        '& .MuiTabs-indicator': {
                          backgroundColor: theme.palette.secondary.main,
                        },
                      }}
                    >
                      <Tab
                        label="All"
                        sx={{
                          textTransform: 'none',
                          color: theme.palette.grey[100],
                          '&.Mui-selected': {
                            color: theme.palette.secondary.main,
                          },
                        }}
                      />
                      {assessments?.map((assessment, index) => (
                        <Tab
                          key={index}
                          label={assessment.type.split('_').map(word =>
                            word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' ')}
                          sx={{
                            textTransform: 'none',
                            color: theme.palette.grey[100],
                            '&.Mui-selected': {
                              color: theme.palette.secondary.main,
                            },
                          }}
                        />
                      ))}
                    </Tabs>
                  </Box>
                )}

                {/* Candidates list */}
                {loading ? (
                  <CandidateSkeletonLoader />
                ) : filteredCandidates?.applications?.length === 0 ? (
                  <EmptyState
                    subTabValue={subTabValue}
                    assessmentType={subTabValue === 1 ? assessments[selectedAssessmentType]?.type : undefined}
                  />
                ) : (
                  <>

                    {/* Desktop View */}
                    <Box
                      sx={{
                        maxWidth: '100%',
                        width: '100%',
                        height: "100%",
                        overflowX: "hidden",
                        overflowY: "auto",
                        pt: 0,
                        pb: 2,
                        display: { xs: "none", lg: "block" },
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#032B4420 transparent',
                        '&::-webkit-scrollbar': {
                          height: '4px',
                          width: '4px',
                        },
                        '&::-webkit-scrollbar-track': {
                          background: 'transparent',
                        },
                        '&::-webkit-scrollbar-thumb': {
                          background: '#032B44',
                          width: '4px',
                          borderRadius: '4px',
                          '&:hover': {
                            background: 'rgba(68, 68, 226, 0.3)',
                          },
                        },
                      }}
                    >
                      {filteredCandidates?.applications?.map((candidate) => (
                        <Box
                          width={'100%'}
                          key={candidate.id}
                          sx={{
                            backgroundColor: "white",
                            borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
                            "&:last-child": {
                              borderBottom: "none",
                            },
                          }}
                        >
                          <CandidateListSection
                            isQuickActionsVisible={true}
                            isCheckboxVisible={true}
                            candidate={candidate}
                            isSelected={selectedEntries?.includes(candidate.id)}
                            onSelectCandidate={handleSelectCandidate}
                            onUpdateStages={(action)=>openEmailModalForAction(action)}
                            // disableSelection={
                            //   filteredCandidates?.applications?.length === 1
                            // }
                            currentStage={getStageValue(subTabValue)}
                            selectedEntries={selectedEntries}
                            setSelectedEntries={setSelectedEntries}
                            onNotification={handleNotification}
                            phaseOptions={dynamicPhaseOptions}
                          />
                        </Box>
                      ))}
                    </Box>

                    {/* Mobile View - componentized */}
                    <MobileCandidateGrid
                      candidates={filteredCandidates?.applications || []}
                      selectedEntries={selectedEntries}
                      subTabValue={subTabValue}
                      isMovingStage={isMovingStage}
                      getStageValue={getStageValue}
                      handleSelectCandidate={handleSelectCandidate}
                      handleCardClick={handleCardClick}
                      handleUpdateStages={openEmailModalForAction}
                      getSkillChipColor={getSkillChipColor}
                      theme={theme}
                    />
                  </>
                )}
                {/* Pagination controls */}
                {primaryTabValue === 0 && totalPages > 0 && (

                  <Box sx={{ mx: 'auto', display: 'flex', alignItems: 'start', justifyContent: 'space-between', mt: 3, mb: 0 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <Pagination
                        count={totalPages}
                        page={page}
                        onChange={handlePageChange}
                        color="primary"
                        size="large"
                        showFirstButton
                        showLastButton
                        sx={{
                          '& .MuiPaginationItem-root': {
                            fontSize: '16px',
                            fontWeight: 500,
                          },
                          '& .Mui-selected': {
                            backgroundColor: 'primary.main',
                            color: 'white',
                            '&:hover': {
                              backgroundColor: 'primary.dark',
                            },
                          },
                        }}
                      />
                      <Typography
                        variant="body2"
                        color="grey.200"
                        align="center"
                        sx={{ mb: 3 }}
                      >
                        Showing <span style={{ fontWeight: 600 }}>{((page - 1) * perPage) + 1}</span> to <span style={{ fontWeight: 600 }}>{Math.min(page * perPage, totalItems)}</span> of <span style={{ fontWeight: 600 }}>{totalItems}</span> entries
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" color="grey.200">Show per Page:</Typography>
                      <FormControl size="small" sx={{ minWidth: 72, borderRadius: '1000px' }}>
                        <Select
                          value={perPage}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            setPerPage(next);
                            setPage(1);
                          }}
                        >
                          <MenuItem value={5}>5</MenuItem>
                          <MenuItem value={10}>10</MenuItem>
                          <MenuItem value={20}>20</MenuItem>
                          <MenuItem value={30}>30</MenuItem>
                          <MenuItem value={50}>50</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  </Box>
                )}
              </Paper>
              {/* Bulk Email Modal */}
              <Dialog
                open={emailModalOpen}
                onClose={() => setEmailModalOpen(false)}
                fullWidth
                maxWidth="md"
              >
                <DialogTitle sx={{ fontWeight: 600, color: "rgba(17, 17, 17, 0.92)" }}>
                  {pendingAction ? `Send email for ${pendingAction.replace("_", " ")}` : "Send Email"}
                </DialogTitle>
                <DialogContent dividers sx={{ bgcolor: theme.palette.background.paper }}>
                  {emailLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                      <CircularProgress />
                    </Box>
                  ) : (

                    <Box sx={{
                      '& .quill': {
                        bgcolor: '#FFF',
                        borderRadius: '8px',
                        border: '0.8px solid rgba(17, 17, 17, 0.14)',
                        transition: 'all 0.3s ease',
                        '&:focus-within': {
                          border: `0.8px solid ${theme.palette.primary.main}`,
                          boxShadow: `0 0 0 1px ${theme.palette.primary.main}25`,
                        },
                        '& .ql-toolbar': {
                          borderTopLeftRadius: '8px',
                          borderTopRightRadius: '8px',
                          border: 'none',
                          borderBottom: '0.8px solid rgba(17, 17, 17, 0.14)',
                        },
                        '& .ql-container': {
                          border: 'none',
                          borderBottomLeftRadius: '8px',
                          borderBottomRightRadius: '8px',
                        }
                      }
                    }}>
                      {/* @ts-ignore - ReactQuill loaded dynamically */}
                      <ReactQuill className="quill" theme="snow" value={emailContent} onChange={setEmailContent} modules={quillModules} formats={quillFormats} />
                    </Box>
                  )}
                  {emailError && (
                    <Alert severity="error" sx={{ mt: 2 }}>{emailError}</Alert>
                  )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                  <Button onClick={() => setEmailModalOpen(false)} variant="outlined" color="primary">
                    Cancel
                  </Button>
                  <Button
                    onClick={async()=>await handleSendBulkEmailAndMoveStage()}
                    variant="contained"
                    color="secondary"
                    disabled={emailLoading || !emailContent}
                  >
                    {emailLoading ? <CircularProgress size={20} color="inherit" /> : 'Send'}
                  </Button>
                </DialogActions>
              </Dialog>
            </Box>
          </Stack>
        ) : (
          // Job description tab with skeleton loader
          <Paper sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
            {loading ? (
              <JobDescriptionSkeleton />
            ) : jobDetails ? (
              <JobDescription jobDetails={jobDetails} loading={loading} error={error} getJobId={getJobId} setError={setError} setPrimaryTabValue={setPrimaryTabValue} />
            ) : error ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="error">{error}</Typography>
              </Box>
            ) : (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="textSecondary">No job details available</Typography>
              </Box>
            )}
          </Paper>
        )}


      </Container>
    </Box>
  );
}
