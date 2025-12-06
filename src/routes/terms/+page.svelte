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
  <title>Terms of Service | ItsOCR</title>
</svelte:head>

<section class="border-t py-16 lg:py-24">
  <div class="mx-auto max-w-4xl px-4 sm:px-6">
    <div class="mb-8 space-y-2">
      <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
        Terms of Service
      </h1>
      <p class="text-sm text-muted-foreground sm:text-base">
        Last updated: 06 December 2025
      </p>
      <p class="text-sm text-muted-foreground sm:text-base">
        These terms govern your access to and use of ItsOCR. By using the service, you agree to these terms.
      </p>
    </div>

    <Card class="shadow-sm">
      <CardHeader class="space-y-1">
        <CardTitle class="text-lg">
          Agreement
        </CardTitle>
        <CardDescription>
          Please read these terms carefully before using ItsOCR.
        </CardDescription>
      </CardHeader>

      <CardContent class="space-y-8 text-sm leading-relaxed text-muted-foreground">
        <div class="space-y-2">
          <h2 class="text-base font-semibold text-foreground">
            1. Use of the service
          </h2>
          <p>
            You may use ItsOCR to upload images and documents for OCR processing and to manage the resulting text within your
            account. You are responsible for all activity that occurs under your account.
          </p>
        </div>

        <Separator />

        <div class="space-y-2">
          <h2 class="text-base font-semibold text-foreground">
            2. Acceptable content
          </h2>
          <p>
            You agree not to upload content that is illegal, harmful, or infringes on the rights of others. You are solely
            responsible for ensuring that you have the right to process the images and documents you upload to the service.
          </p>
        </div>

        <Separator />

        <div class="space-y-2">
          <h2 class="text-base font-semibold text-foreground">
            3. Intellectual property
          </h2>
          <p>
            You retain ownership of the content you upload. By using ItsOCR, you grant us a limited, worldwide, non-exclusive
            license to process and store your content solely for the purpose of providing the service.
          </p>
          <p>
            The ItsOCR name, branding, and platform code remain the property of the project maintainers and licensors.
          </p>
        </div>

        <Separator />

        <div class="space-y-2">
          <h2 class="text-base font-semibold text-foreground">
            4. Availability and changes
          </h2>
          <p>
            We aim to keep the service available and reliable, but we do not guarantee uninterrupted operation. Features may change,
            be added, or be removed over time.
          </p>
          <p>
            We may update these terms from time to time. Continued use of the service after changes take effect constitutes your
            acceptance of the revised terms.
          </p>
        </div>

        <Separator />

        <div class="space-y-2">
          <h2 class="text-base font-semibold text-foreground">
            5. Disclaimer
          </h2>
          <p>
            The service is provided on an “as is” and “as available” basis, without warranties of any kind. We do not guarantee the
            accuracy of OCR results or suitability of the service for any particular purpose.
          </p>
        </div>

        <Separator />

        <div class="space-y-2">
          <h2 class="text-base font-semibold text-foreground">
            6. Limitation of liability
          </h2>
          <p>
            To the maximum extent permitted by law, ItsOCR and its maintainers shall not be liable for any indirect, incidental, or
            consequential damages arising out of or in connection with your use of the service.
          </p>
        </div>

        <Separator />

        <div class="space-y-2">
          <h2 class="text-base font-semibold text-foreground">
            7. Termination
          </h2>
          <p>
            You may stop using the service at any time. We may suspend or terminate your access if you violate these terms or use
            the service in a way that risks harm to the platform or other users.
          </p>
        </div>

        <Separator />

        <div class="space-y-2">
          <h2 class="text-base font-semibold text-foreground">
            8. Contact
          </h2>
          <p>
            If you have questions about these terms or your use of the service, please contact the ItsOCR team using the contact
            information provided on the website.
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</section>
