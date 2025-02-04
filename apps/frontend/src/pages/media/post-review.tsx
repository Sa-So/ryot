import type { NextPageWithLayout } from "../_app";
import LoadingPage from "@/lib/layouts/LoadingPage";
import LoggedIn from "@/lib/layouts/LoggedIn";
import { gqlClient } from "@/lib/services/api";
import {
	Box,
	Button,
	Checkbox,
	Container,
	Input,
	Rating,
	SegmentedControl,
	Stack,
	Textarea,
	Title,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import {
	MediaDetailsDocument,
	MediaItemReviewsDocument,
	PostReviewDocument,
	type PostReviewMutationVariables,
	ReviewVisibility,
} from "@ryot/generated/graphql/backend/graphql";
import { useMutation, useQuery } from "@tanstack/react-query";
import Head from "next/head";
import { useRouter } from "next/router";
import { type ReactElement } from "react";
import invariant from "tiny-invariant";
import { z } from "zod";

const formSchema = z.object({
	rating: z.preprocess(Number, z.number().min(0).max(5)).default(0),
	text: z.string().optional(),
	visibility: z.nativeEnum(ReviewVisibility).default(ReviewVisibility.Private),
	spoiler: z.boolean().optional(),
});
type FormSchema = z.infer<typeof formSchema>;

const Page: NextPageWithLayout = () => {
	const router = useRouter();
	const metadataId = parseInt(router.query.item?.toString() || "0");
	const reviewId = Number(router.query.reviewId?.toString()) || null;
	const seasonNumber = Number(router.query.seasonNumber?.toString()) || null;
	const episodeNumber = Number(router.query.episodeNumber?.toString()) || null;

	const form = useForm<FormSchema>({
		validate: zodResolver(formSchema),
	});

	const mediaDetails = useQuery({
		queryKey: ["mediaDetails", metadataId],
		queryFn: async () => {
			const { mediaDetails } = await gqlClient.request(MediaDetailsDocument, {
				metadataId: metadataId,
			});
			return mediaDetails;
		},
		staleTime: Infinity,
	});
	useQuery({
		queryKey: ["reviewDetails", metadataId, reviewId],
		queryFn: async () => {
			invariant(reviewId, "Can not get review details");
			const { mediaItemReviews } = await gqlClient.request(
				MediaItemReviewsDocument,
				{
					metadataId: metadataId,
				},
			);
			const review = mediaItemReviews.find((m) => m.id === reviewId);
			return review;
		},
		enabled: reviewId !== undefined,
		onSuccess: (data) => {
			form.setValues({
				rating: data?.rating || 0,
				text: data?.text || "",
				visibility: data?.visibility,
				spoiler: data?.spoiler !== undefined ? data?.spoiler : false,
			});
			form.resetDirty();
		},
	});
	const postReview = useMutation({
		mutationFn: async (variables: PostReviewMutationVariables) => {
			const { postReview } = await gqlClient.request(
				PostReviewDocument,
				variables,
			);
			return postReview;
		},
		onSuccess: () => {
			router.push(`/media?item=${metadataId}`);
		},
	});

	const title = mediaDetails.data?.title;

	return mediaDetails.data && title ? (
		<>
			<Head>
				<title>Post Review | Ryot</title>
			</Head>
			<Container size={"xs"}>
				<Box
					component="form"
					onSubmit={form.onSubmit((values) => {
						postReview.mutate({
							input: {
								metadataId,
								...values,
								seasonNumber,
								episodeNumber,
								reviewId,
							},
						});
					})}
				>
					<Stack>
						<Title order={3}>
							Reviewing "{title}
							{seasonNumber ? ` (S${seasonNumber}` : null}
							{episodeNumber ? `-E${episodeNumber})` : null}"
						</Title>
						<Box>
							<Input.Label>Rating</Input.Label>
							<Rating {...form.getInputProps("rating")} fractions={2} />
						</Box>
						<Textarea
							label="Review"
							{...form.getInputProps("text")}
							autoFocus
						/>
						<Box>
							<Input.Label>Visibility</Input.Label>
							<SegmentedControl
								fullWidth
								data={[
									{
										label: ReviewVisibility.Private,
										value: ReviewVisibility.Private,
									},
									{
										label: ReviewVisibility.Public,
										value: ReviewVisibility.Public,
									},
								]}
								{...form.getInputProps("visibility")}
							/>
						</Box>
						<Checkbox
							label="This review is a spoiler"
							{...form.getInputProps("spoiler")}
						/>
						<Button
							mt="md"
							type="submit"
							loading={postReview.isLoading}
							w="100%"
						>
							{reviewId ? "Update" : "Submit"}
						</Button>
					</Stack>
				</Box>
			</Container>
		</>
	) : (
		<LoadingPage />
	);
};

Page.getLayout = (page: ReactElement) => {
	return <LoggedIn>{page}</LoggedIn>;
};

export default Page;
