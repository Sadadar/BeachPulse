export const typeDefs = `#graphql
  enum TournamentTier {
    ELITE16
    CHALLENGER
    AVP_PRO
    FUTURES
    MAJOR
  }

  enum MatchStatus {
    SCHEDULED
    LIVE
    COMPLETED
    CANCELLED
  }

  enum Gender {
    MEN
    WOMEN
  }

  enum MatchConfidence {
    HIGH
    MEDIUM
    LOW
  }

  type Player {
    id: ID!
    name: String!
    country: String
    gender: Gender
    tvrRating: Float
    tvrRatingSource: String
    avpRank: Int
    currentPartner: Player
    upcomingMatches: [Match!]!
    recentResults: [Match!]!
    confidence: MatchConfidence!
  }

  type Team {
    player1: Player!
    player2: Player
    seed: Int
  }

  type Tournament {
    id: ID!
    name: String!
    tier: TournamentTier
    city: String!
    country: String!
    startDate: String!
    endDate: String!
    gender: Gender
    followedPlayersCount: Int!
    registeredTeams: [Team!]!
    matches: [Match!]!
    sourceUrl: String!
  }

  type Match {
    id: ID!
    tournament: Tournament!
    round: String!
    scheduledAt: String!
    scheduledAtLocalEvent: String
    timezone: String
    team1: Team!
    team2: Team
    score: String
    status: MatchStatus!
    watchUrl: String
    sourceUrl: String!
  }

  type FeedData {
    live: [Match!]!
    upcoming: [Match!]!
    recent: [Match!]!
    tournamentsWithoutFollowedPlayers: [Tournament!]!
  }

  type Query {
    # Feed screen — live + upcoming + recent matches for followed players
    feed(playerIds: [ID!]!): FeedData!

    # All tournaments, optionally filtered
    tournaments(search: String, tier: TournamentTier, gender: Gender): [Tournament!]!

    # Single tournament with full draw
    tournament(id: ID!): Tournament

    # Player lookup by ID
    player(id: ID!): Player

    # Player search across all sources
    searchPlayers(q: String!, gender: Gender): [Player!]!

    # AVP rankings (existing functionality, now via GraphQL)
    avpRankings(gender: Gender): [Player!]!
  }
`;
