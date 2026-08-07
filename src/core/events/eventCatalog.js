export const DomainEvents=Object.freeze({
 COMPANY_CREATED:'organization.company.created',
 COMPANY_UPDATED:'organization.company.updated',
 COMPANY_ARCHIVED:'organization.company.archived',
 SITE_CREATED:'organization.site.created',
 SITE_UPDATED:'organization.site.updated',
 SITE_ARCHIVED:'organization.site.archived',
 USER_CREATED:'identity.user.created',
 USER_ACTIVATED:'identity.user.activated',
 USER_DEACTIVATED:'identity.user.deactivated',
 USER_DELETED:'identity.user.deleted',
 USER_SESSION_SELECTED:'identity.user.session_selected',
 CROP_LOT_CREATED:'cultivation.lot.created',
 CROP_PHASE_CHANGED:'cultivation.lot.phase_changed',
 MIPE_FINDING_RECORDED:'mipe.finding.recorded',
 MIRFE_APPLICATION_COMPLETED:'mirfe.application.completed',
 INVENTORY_MOVEMENT_RECORDED:'inventory.movement.recorded',
 PRODUCTION_STAGE_COMPLETED:'production.stage.completed'
})

export function isKnownDomainEvent(name){return Object.values(DomainEvents).includes(name)}
