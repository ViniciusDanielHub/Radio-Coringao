// src/shared/services/clube-api/admin.routes.ts
//
// Rotas /api/admin/* da clube-api.
//
// MUDANÇA: a clube-api agora protege essas rotas com o JWT real do admin
// (ver clube-api/src/shared/plugins/admin-auth.plugin.ts) em vez de uma
// x-api-key fixa. Por isso toda função aqui passou a receber `accessToken`
// como último parâmetro — é o token do admin autenticado que disparou a
// ação na sports-news-api, repassado para a clube-api validar localmente.

import { request, buildQueryString } from './http';
import type {
  Team,
  Category,
  CompetitionWithCategory,
  Opponent,
  Match,
  MatchWithRelations,
  StandingEntryWithGoalDifference,
  SquadMember,
  PlayerMovementWithSquadMember,
  TransferClub,
} from './types/entities';
import type {
  UpdateTeamPayload,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  CreateCompetitionPayload,
  UpdateCompetitionPayload,
  CreateOpponentPayload,
  UpdateOpponentPayload,
  CreateMatchPayload,
  UpdateMatchPayload,
  UpsertStandingRowPayload,
  BulkStandingRow,
  CreateSquadMemberPayload,
  UpdateSquadMemberPayload,
  CreatePlayerMovementPayload,
  UpdatePlayerMovementPayload,
  UpdateTransferClubPayload,
  CreateTransferClubPayload,
} from './types/payloads';
import type {
  ListAdminMatchesParams,
  ListAdminSquadParams,
  ListAdminMovementsParams,
  PaginatedResponse,
  MessageResponse,
  BulkReplaceResponse,
} from './types/queries';

export const clubeApiAdmin = {
  team: {
    update: (data: UpdateTeamPayload, accessToken: string) =>
      request<Team, UpdateTeamPayload>('/api/admin/team', {
        method: 'PATCH', body: data, accessToken,
      }),
  },

  categories: {
    list: (accessToken: string) =>
      request<Category[]>('/api/admin/categories', { accessToken }),
    create: (data: CreateCategoryPayload, accessToken: string) =>
      request<Category, CreateCategoryPayload>('/api/admin/categories', {
        method: 'POST', body: data, accessToken,
      }),
    update: (id: string, data: UpdateCategoryPayload, accessToken: string) =>
      request<Category, UpdateCategoryPayload>(`/api/admin/categories/${id}`, {
        method: 'PATCH', body: data, accessToken,
      }),
    delete: (id: string, accessToken: string) =>
      request<MessageResponse>(`/api/admin/categories/${id}`, {
        method: 'DELETE', accessToken,
      }),
  },

  competitions: {
    list: (accessToken: string) =>
      request<CompetitionWithCategory[]>('/api/admin/competitions', { accessToken }),
    create: (data: CreateCompetitionPayload, accessToken: string) =>
      request<Match, CreateCompetitionPayload>('/api/admin/competitions', {
        method: 'POST', body: data, accessToken,
      }),
    update: (id: string, data: UpdateCompetitionPayload, accessToken: string) =>
      request<Match, UpdateCompetitionPayload>(`/api/admin/competitions/${id}`, {
        method: 'PATCH', body: data, accessToken,
      }),
    delete: (id: string, accessToken: string) =>
      request<MessageResponse>(`/api/admin/competitions/${id}`, {
        method: 'DELETE', accessToken,
      }),
  },

  opponents: {
    create: (data: CreateOpponentPayload, accessToken: string) =>
      request<Opponent, CreateOpponentPayload>('/api/admin/opponents', {
        method: 'POST', body: data, accessToken,
      }),
    update: (id: string, data: UpdateOpponentPayload, accessToken: string) =>
      request<Opponent, UpdateOpponentPayload>(`/api/admin/opponents/${id}`, {
        method: 'PATCH', body: data, accessToken,
      }),
    delete: (id: string, accessToken: string) =>
      request<MessageResponse>(`/api/admin/opponents/${id}`, {
        method: 'DELETE', accessToken,
      }),
  },

  matches: {
    list: (params: ListAdminMatchesParams | undefined, accessToken: string) =>
      request<PaginatedResponse<MatchWithRelations>>(
        `/api/admin/matches${buildQueryString({ page: params?.page ?? 1, limit: params?.limit ?? 20 })}`,
        { accessToken },
      ),
    create: (data: CreateMatchPayload, accessToken: string) =>
      request<MatchWithRelations, CreateMatchPayload>('/api/admin/matches', {
        method: 'POST', body: data, accessToken,
      }),
    update: (id: string, data: UpdateMatchPayload, accessToken: string) =>
      request<MatchWithRelations, UpdateMatchPayload>(`/api/admin/matches/${id}`, {
        method: 'PATCH', body: data, accessToken,
      }),
    delete: (id: string, accessToken: string) =>
      request<MessageResponse>(`/api/admin/matches/${id}`, {
        method: 'DELETE', accessToken,
      }),
  },

  standings: {
    upsertRow: (data: UpsertStandingRowPayload, accessToken: string) =>
      request<StandingEntryWithGoalDifference, UpsertStandingRowPayload>(
        '/api/admin/standings',
        { method: 'POST', body: data, accessToken },
      ),
    bulkReplace: (competitionId: string, rows: BulkStandingRow[], accessToken: string) =>
      request<BulkReplaceResponse, BulkStandingRow[]>(
        `/api/admin/standings/${competitionId}/bulk`,
        { method: 'PUT', body: rows, accessToken },
      ),
    deleteRow: (id: string, accessToken: string) =>
      request<MessageResponse>(`/api/admin/standings/${id}`, {
        method: 'DELETE', accessToken,
      }),
  },

  squad: {
    list: (params: ListAdminSquadParams | undefined, accessToken: string) =>
      request<SquadMember[]>(`/api/admin/squad${buildQueryString(params)}`, { accessToken }),
    create: (data: CreateSquadMemberPayload, accessToken: string) =>
      request<SquadMember, CreateSquadMemberPayload>('/api/admin/squad', {
        method: 'POST', body: data, accessToken,
      }),
    update: (id: string, data: UpdateSquadMemberPayload, accessToken: string) =>
      request<SquadMember, UpdateSquadMemberPayload>(`/api/admin/squad/${id}`, {
        method: 'PATCH', body: data, accessToken,
      }),
    delete: (id: string, accessToken: string) =>
      request<MessageResponse>(`/api/admin/squad/${id}`, {
        method: 'DELETE', accessToken,
      }),
  },

  movements: {
    list: (params: ListAdminMovementsParams | undefined, accessToken: string) =>
      request<PaginatedResponse<PlayerMovementWithSquadMember>>(
        `/api/admin/movements${buildQueryString(params)}`,
        { accessToken },
      ),
    create: (data: CreatePlayerMovementPayload, accessToken: string) =>
      request<PlayerMovementWithSquadMember, CreatePlayerMovementPayload>(
        '/api/admin/movements',
        { method: 'POST', body: data, accessToken },
      ),
    update: (id: string, data: UpdatePlayerMovementPayload, accessToken: string) =>
      request<PlayerMovementWithSquadMember, UpdatePlayerMovementPayload>(
        `/api/admin/movements/${id}`,
        { method: 'PATCH', body: data, accessToken },
      ),
    delete: (id: string, accessToken: string) =>
      request<MessageResponse>(`/api/admin/movements/${id}`, {
        method: 'DELETE', accessToken,
      }),

    transferClubs: {
      list: (accessToken: string) =>
        request<TransferClub[]>('/api/admin/transfer-clubs', { accessToken }),
      create: (data: CreateTransferClubPayload, accessToken: string) =>
        request<TransferClub, CreateTransferClubPayload>('/api/admin/transfer-clubs', {
          method: 'POST', body: data, accessToken,
        }),
      update: (id: string, data: UpdateTransferClubPayload, accessToken: string) =>
        request<TransferClub, UpdateTransferClubPayload>(`/api/admin/transfer-clubs/${id}`, {
          method: 'PATCH', body: data, accessToken,
        }),
      delete: (id: string, accessToken: string) =>
        request<MessageResponse>(`/api/admin/transfer-clubs/${id}`, {
          method: 'DELETE', accessToken,
        }),
    },
  },
};