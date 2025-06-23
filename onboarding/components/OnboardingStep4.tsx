"use client";
import React from "react";
import { Typography, TextField, Stack, FormHelperText } from "@mui/material";

interface OnboardingStep4Props {
  data: {
    company_bio: string;
  };
  onUpdate: (data: { company_bio: string }) => void;
}

const OnboardingStep4: React.FC<OnboardingStep4Props> = ({ data, onUpdate }) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ company_bio: event.target.value });
  };
  
  const minLength = 50;
  const isError = data.company_bio.length > 0 && data.company_bio.length < minLength;

  return (
    <Stack spacing={2}>
      <Typography variant="h4" fontWeight="bold">About Your Company</Typography>
      <Typography color="grey.200" maxWidth="600px">
        Tell candidates about your company's mission, values, and culture.
      </Typography>
      <TextField
        fullWidth
        label="Company Bio"
        multiline
        rows={8}
        placeholder="What makes your company a great place to work?"
        value={data.company_bio}
        onChange={handleChange}
        variant="outlined"
        sx={{ mt: 2 ,'&.MuiInputLabel-root[data-shrink="false"]': { color: 'grey.200 !important' }}}
        error={isError}
      />
      <FormHelperText sx={{ textAlign: 'right', mt: 1, ...(isError && { color: 'error.main'}) }}>
        {data.company_bio.length} characters (minimum {minLength})
      </FormHelperText>
    </Stack>
  );
};

export default OnboardingStep4;
