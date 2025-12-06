<script lang="ts">
  import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent
  } from "$lib/components/ui/card";
  import { Separator } from "$lib/components/ui/separator";
</script>

<svelte:head>
  <title>Privacy Policy | ItsOCR</title>
</svelte:head>

<section class="border-t py-16 lg:py-24">
  <div class="mx-auto max-w-4xl px-4 sm:px-6">
    <div class="mb-8 space-y-2">
      <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
        Privacy Policy
      </h1>
      <p class="text-sm text-muted-foreground sm:text-base">
        Last updated: 06 December 2025
      </p>
      <p class="text-sm text-muted-foreground sm:text-base">
        This privacy policy explains how ItsOCR collects, uses, and protects information when you use the service.
      </p>
    </div>

    <Card class="shadow-sm">
      <CardHeader class="space-y-1">
        <CardTitle class="text-lg">
          Overview
        </CardTitle>
        <CardDescription>
          We collect only the data necessary to provide the OCR service, operate your account, and improve the product.
        </CardDescription>
      </CardHeader>

      <CardContent class="space-y-8 text-sm leading-relaxed text-muted-foreground">
        <div class="space-y-2">
          <h2 class="text-base font-semibold text-foreground">
            1. Information we collect
          </h2>
          <p>
            Depending on how you use ItsOCR, we may collect:
          </p>
          <ul class="list-disc space-y-1 pl-5">
            <li>Account details such as name, email address, and authentication data.</li>
            <li>Uploaded images and documents you submit for OCR processing.</li>
            <li>Usage data such as timestamps, feature usage, and basic technical information from your browser.</li>
          </ul>
        </div>

        <Separator />

        <div class="space-y-2">
          <h2 class="text-base font-semibold text-foreground">
            2. How we use your data
          </h2>
          <p>
            We use the collected information to:
          </p>
          <ul class="list-disc space-y-1 pl-5">
            <li>Provide OCR processing and related features.</li>
            <li>Secure your account and authenticate access to the dashboard.</li>
            <li>Monitor performance, prevent abuse, and improve the service.</li>
          </ul>
        </div>

        <Separator />

        <div class="space-y-2">
          <h2 class="text-base font-semibold text-foreground">
            3. Storage of images and text
          </h2>
          <p>
            Uploaded images are stored in secure object storage and linked to your account. Extracted text may be saved to allow you
            to revisit previous scans, export results, and view processing history in your dashboard.
          </p>
          <p>
            You can delete individual scans from the dashboard, which removes the associated image and extracted text from the service.
          </p>
        </div>

        <Separator />

        <div class="space-y-2">
          <h2 class="text-base font-semibold text-foreground">
            4. Third-party services
          </h2>
          <p>
            ItsOCR may use third-party infrastructure providers for hosting, storage, analytics, or model inference. These providers
            process data on our behalf and are required to follow appropriate security and privacy practices.
          </p>
        </div>

        <Separator />

        <div class="space-y-2">
          <h2 class="text-base font-semibold text-foreground">
            5. Data security
          </h2>
          <p>
            We apply reasonable technical and organizational measures to protect your data, including encrypted connections, access
            controls, and monitoring. However, no online service can guarantee absolute security.
          </p>
        </div>

        <Separator />

        <div class="space-y-2">
          <h2 class="text-base font-semibold text-foreground">
            6. Your choices and rights
          </h2>
          <p>
            You can:
          </p>
          <ul class="list-disc space-y-1 pl-5">
            <li>Review and update your account details in the app.</li>
            <li>Delete specific scans from your dashboard.</li>
            <li>Contact us to request deletion of your account and associated data.</li>
          </ul>
        </div>

        <Separator />

        <div class="space-y-2">
          <h2 class="text-base font-semibold text-foreground">
            7. Contact
          </h2>
          <p>
            If you have questions about this privacy policy or how your data is handled, you can contact the ItsOCR team using the
            email address provided on the website.
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</section>
