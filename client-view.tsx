import React, {
    ElementRef,
    FC,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import Box from "@mui/material/Box";
import { Link as RouterLink, useParams } from "react-router-dom";
import useEstimates, {
    AssemblyAction,
    IEstimateAreaInput,
    IEstimateAreaModel,
    IEstimateAssemblyCategoryModel,
    IEstimateAssemblyDbModel,
    IEstimateAssemblyInput,
    IEstimateDiscountInputs,
    IEstimateDiscountModel,
    IEstimateEntryItemModel,
    IEstimateEntryModel,
    IEstimateInfoInputs,
    IEstimateModel
} from "../../hooks/api/estimates";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import EstimateHeader from "./components/EstimateHeader";
import { useDialog } from "../../hooks/dialog";
import EmptyStage from "../../components/EmptyStage";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent, DialogProps,
    DialogTitle,
    Grid,
    Link, Menu, MenuItem,
    Stack,
    useMediaQuery,
    useTheme
} from "@mui/material";
import AreaSidebar from "./components/AreaSidebar";
import EstimateToolbar from "./components/EstimateToolbar";
import AreaNotes from "./components/AreaNotes";
import CategoryEntries from "./components/CategoryEntries";
import Typography from "@mui/material/Typography";
import { useLocalStorage } from "../../hooks/local-storage";
import { usePageTitle } from "../../hooks/page-title";
import { useBreadcrumbs, useTrackHistory } from "../../hooks/breadcrumbs";
import BreadcrumbItem from "../../components/BreadcrumbItem";
import ConfirmDialog from "../../components/dialogs/ConfirmDialog";
import EstimateDuplicateAreaDialog from "../../components/dialogs/estimates/EstimateDuplicateAreaDialog";
import { handleError, useAddressFormatter } from "../../utils";
import { toast } from "react-toastify";
import EstimateDialog from "../../components/dialogs/estimates/EstimateDialog";
import EstimateAreaDialog, { useEstimateAreaDialog } from "../../components/dialogs/estimates/EstimateAreaDialog";
import EstimateDiscountDialog from "../../components/dialogs/estimates/EstimateDiscountDialog";
import AssemblyPanel from "./components/AssemblyPanel";
import EditAssemblyPanel from "./components/EditAssemblyPanel";
import { EstimateEntryColumns } from "../../enums";
import debounce from "lodash.debounce";
import Skeleton from "@mui/material/Skeleton";
import EstimateManageDiscountDialog from "../../components/dialogs/estimates/EstimateManageDiscountDialog";
import ColumnSettings from "./components/ColumnSettings";
import ReorderCategoriesPanel from "./components/ReorderCategoriesPanel";
import AreaListMobile from "./components/AreaListMobile";
import ProjectInfoPanel, { useProjectInfoPanel } from "../../components/ProjectInfoPanel";
import { useMetadataStore } from "../../store/metadata";
import TemplatePicker from "./components/TemplatePicker";
import { IEstimateTemplateModel } from "../../interfaces";
import CircularProgressButton from "../../components/CircularProgressButton";
import useFinancingPlans from "../financing-plans/hooks/useFinancingPlans";
import ComponentPanel from "./components/AddComponentPanel";
import { axios } from "../../common";
import { useCompanySettings } from "../../hooks/company";
import usePopover from "../../hooks/popover";

const useAddComponentMutation = () => {
    return useMutation({
        mutationFn: (payload: { estimateIdHash: string, areaIdHash: string, data: unknown }) => {
            const { estimateIdHash, areaIdHash, data } = payload
            return axios.post<IEstimateEntryModel>(`/api/v2/estimates/${estimateIdHash}/areas/${areaIdHash}/component`, data)
        }
    })
}

const EstimateView: FC = () => {

    usePageTitle('Estimate')
    const theme = useTheme()
    const isLg = useMediaQuery(theme.breakpoints.up('lg'), { noSsr: true })
    const setBreadcrumbs = useBreadcrumbs()
    const trackHistory = useTrackHistory()
    const params = useParams()
    const deleteEstimateDialog = useDialog()
    const editEstimateInfoDialog = useDialog()
    const applyEstimateDiscountDialog = useDialog()
    const deleteEstimateAreaDialog = useDialog()
    const duplicateEstimateAreaDialog = useDialog()
    const assemblyPanel = useDialog()
    const componentPanel = useDialog()
    const importFromTemplatesDialog = useDialog()
    const manageEstimateDiscountDialog = useDialog()
    const columnSettingsDialog = useDialog()
    const { features } = useCompanySettings()

    const estimateIdHash = params.idHash!

    const [editDiscount, setEditDiscount] = useState<IEstimateDiscountModel | undefined>()
    const [selectedAreaIndex, setSelectedAreaIndex] = useLocalStorage(`selectedArea.${estimateIdHash}`, 0)
    const [selectedDiscountIndex, setSelectedDiscountIndex] = useLocalStorage(`selectedDiscount.${estimateIdHash}`, 0)
    const [showWorkScopes, setShowWorkScopes] = useLocalStorage('showWorkScopes', false)
    const [showEmptyCategories, setShowEmptyCategories] = useLocalStorage('showEmptyCategories', false)
    const [editArea, setEditArea] = useState<IEstimateAreaModel | undefined>()
    const [assemblyPanelCategory, setAssemblyPanelCategory] = useState<IEstimateAssemblyCategoryModel | undefined>()
    const [selectedAssemblies, setSelectedAssemblies] = useState<number[]>([])
    const [confirmDeleteAssembly, setConfirmDeleteAssembly] = useState<IEstimateEntryModel | undefined>()

    const globalColumnSettingsKey = `estimate.columnSettingsClient`
    const columnSettingsKey = `${globalColumnSettingsKey}.${estimateIdHash}`

    const key = `areaNotesExpand`
    const [_, setExpandAreaNotes] = useLocalStorage(key, true)

    const addComponentMutation = useAddComponentMutation()

    const entryTableColumns = [
        {
            name: EstimateEntryColumns.NAME,
            value: true,
        },
        {
            name: EstimateEntryColumns.ACTION,
            value: true
        },
        {
            name: EstimateEntryColumns.QTY,
            value: true,
        },
        {
            name: EstimateEntryColumns.ALLOWANCE,
            value: true,
        },
        // {
        //     name: EstimateEntryColumns.UNIT_COST,
        //     value: true
        // },
        // {
        //     name: EstimateEntryColumns.COST,
        //     value: true
        // },
        // {
        //     name: EstimateEntryColumns.MARKUP,
        //     value: false,
        // },
        {
            name: EstimateEntryColumns.SELECTION_ADJUSTMENT,
            value: true,
        },
        {
            name: EstimateEntryColumns.PRICE,
            value: true
        },
    ]

    const estimates = useEstimates([
        'project.house',
        'selectionProgress',
        'areaCount',
        'project.contact',
        'project.parent.primaryEstimate',
        'promptEntry.prompt.addOns.unit',
        'estimateAddOns', 'contracts'
    ])

    const queryClient = useQueryClient()

    const estimateQueryKey = ['estimate', estimateIdHash]
    const estimate = useQuery(estimateQueryKey, () => estimates.findByIdHash(estimateIdHash), {
        enabled: !!estimateIdHash,
        onSuccess: (data) => {
            if (data.promptEntry?.prompt && data.promptEntry?.idHash) {
                //navigate(`/prompts/${data.promptEntry?.prompt?.idHash}/entries/${data.promptEntry?.idHash}/estimate`, {replace: true})
            }
        }
    })



    const areasQuery = useQuery(['areas', estimateIdHash], ({ signal }) => estimates.getAreas(estimateIdHash, undefined, signal), { enabled: !!estimate.data?.idHash })

    const { query: { financingPlansQuery } } = useFinancingPlans();

    let currentAreaIdHash = areasQuery.data?.at(selectedAreaIndex)?.idHash
    if (!currentAreaIdHash) {
        currentAreaIdHash = areasQuery.data?.at(0)?.idHash
    }
    const area = useQuery(['area', estimateIdHash, currentAreaIdHash], () => estimates.getArea(estimateIdHash, currentAreaIdHash!), { enabled: !!currentAreaIdHash })

    const units = useMetadataStore(state => state.units)

    // we will use this to select a newly added area
    const selectLastArea = useRef<boolean>(false)

    const estimateAreaDialog = useEstimateAreaDialog()

    const refresh = async () => {
        await queryClient.invalidateQueries(estimateQueryKey, { refetchType: 'all' })
        await queryClient.invalidateQueries(['areas', estimateIdHash], { refetchType: 'all' })
        await queryClient.invalidateQueries(['area', estimateIdHash, currentAreaIdHash], { refetchType: 'all' })
    }

    const handleRequest = async (callback: () => Promise<void>) => {
        try {
            await callback()
            return true
        } catch (error: any) {
            if (error.response.status === 422) {
                const validationErrors = error.response.data
                Object.keys(validationErrors).map((key) => {
                    toast.error(validationErrors[key].message)
                })
            } else {
                const message = handleError(error)
                toast.error(message, { autoClose: false })
            }
            return false
        }
    }

    useEffect(() => {
        if (assemblyPanelCategory) {
            assemblyPanel.open()
        } else {
            assemblyPanel.close()
        }
    }, [assemblyPanelCategory])

    const [itemPanelCategory, setItemPanelCategory] = React.useState<IEstimateAssemblyCategoryModel | null>(null)
    const hybridEstimateAddMenu = usePopover()

    useEffect(() => {
        if (itemPanelCategory) {
            componentPanel.open()
        } else {
            componentPanel.close()
        }
    }, [itemPanelCategory])

    useEffect(() => {
        if (areasQuery.data && areasQuery.data.length > 0 && selectLastArea.current) {
            selectLastArea.current = false
            setSelectedAreaIndex(areasQuery.data.length - 1)
        }
    }, [areasQuery.data])

    const mountRef = useRef(0)

    useEffect(() => {
        if (!estimate.data || mountRef.current !== 0) {
            return
        }
        mountRef.current++

        const history = {
            title: estimate.data.name ?? 'View Estimate',
            url: window.location.href
        }
        trackHistory(history)

        const linkType = estimate.data.project?.pType === 'co' ? 'change-orders' : 'warranty'
        const parentLink = estimate.data.project?.parent ? (
            <BreadcrumbItem key={`breadcrumb-2`}>
                <Link
                    href={`/y/bridge/project/${estimate.data.project.parent.idHash}/${linkType}`}
                >
                    {estimate.data.project.parent.displayName}
                </Link>
            </BreadcrumbItem>
        ) : (
            <BreadcrumbItem
                key={`breadcrumb-2`}
                tooltip={estimate.data.project?.displayName}
            >
                <Link
                    href={`/y/bridge/project/${estimate.data.project?.idHash}/estimate/reports`}
                >
                    {estimate.data.project?.displayName}
                </Link>
            </BreadcrumbItem>
        );

        setBreadcrumbs([
            <RouterLink key={`breadcrumb-1`} to={`/projects`}>Projects</RouterLink>,
            parentLink,
            <BreadcrumbItem key={`breadcrumb-last`} tooltip={estimate.data.name}>
                <Typography>{estimate.data.name}</Typography>
            </BreadcrumbItem>
        ])

    }, [estimate.data])

    const onCategoryReorder = async () => {
        await refresh()
    }

    const categoryRef = useRef<IEstimateAssemblyCategoryModel | null>(null)

    const handleAddItemClick = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>, category: IEstimateAssemblyCategoryModel) => {
        e.stopPropagation()
        if (features?.estimatingStrategy === 'item') {
            setItemPanelCategory(category)
        } else if (features?.estimatingStrategy === 'hybrid') {
            hybridEstimateAddMenu.setAnchorEl(e.currentTarget)
            categoryRef.current = category
        } else {
            setAssemblyPanelCategory(category)
        }
    }

    const handleSelectedEntriesChanged = (entries: number[], categoryId: number) => {
        // need to keep all the entries that are not part of the sending category
        const shouldKeep = area.data?.entries.filter(entry => entry.categoryId !== categoryId).map(entry => entry.id)
        const keep = selectedAssemblies.filter(entryId => shouldKeep && shouldKeep?.indexOf(entryId) >= 0)
        const selected = new Set([...keep, ...entries])
        setSelectedAssemblies(Array.from(selected))
    }

    type EditAssemblyPanelEle = ElementRef<typeof EditAssemblyPanel>
    const editAssemblyDialogRef = useRef<EditAssemblyPanelEle | null>(null)
    const handleEditAssemblyClick = (assembly: IEstimateEntryModel) => {
        const nextAssembly = area.data?.entries.find(e => e.id === assembly.id)
        if (nextAssembly) {
            editAssemblyDialogRef.current?.openDialog(nextAssembly)
        }
    }

    type ReorderCategoryPanelEle = ElementRef<typeof ReorderCategoriesPanel>
    const reorderCategoriesPanelRef = useRef<ReorderCategoryPanelEle | null>(null)
    const handleChangeCategoryOrder = () => {
        if (reorderCategoriesPanelRef.current && area.data) {
            reorderCategoriesPanelRef.current.openDialog(area.data.categories)
        }
    }

    const deleteEstimate = async (estimate: IEstimateModel) => {
        return await handleRequest(async () => {
            const project = estimate.project
            await estimates.remove(estimate.idHash)
            window.location.href = `/y/project/${project?.id}#estimates`
        })
    }

    const handleUpdateEstimateInfo = async (data: IEstimateInfoInputs) => {
        return await handleRequest(async () => {
            await estimates.update(estimates.selectedRecord?.idHash ?? '', data)
            await queryClient.invalidateQueries(['estimate', estimateIdHash])
            toast.success('Estimate information has been updated.')
            await refresh()
            editEstimateInfoDialog.close()
        })
    }

    const setViewDefaults = (isTemplate = true) => {
        if (isTemplate) {
            // hide unused categories
            setShowEmptyCategories(false)
            // hide work scopes
            setShowWorkScopes(false)
            setExpandAreaNotes(true)
        } else {
            // show unused categories
            setShowEmptyCategories(true)
            // hide work scopes
            setShowWorkScopes(false)
            setExpandAreaNotes(true)
        }


    }

    const handleEstimateAreaDialogSubmit = async (data: IEstimateAreaInput, closeOnSubmit: boolean) => {
        let result: boolean
        if (editArea) {
            result = await handleRequest(async () => {
                await estimates.updateArea(estimateIdHash, area.data?.idHash ?? '', data)
            })
        } else {
            // force selection of last area after save
            selectLastArea.current = true
            result = await handleRequest(async () => {
                await estimates.addArea(estimateIdHash, data)
            })
        }

        if (result) {
            await refresh()
            if (closeOnSubmit && result) {
                estimateAreaDialog.current?.close()
            }
            setViewDefaults(data.areaTypeCategoryId !== undefined && data.areaTypeCategoryId !== 0)
        }

        return result
    }

    const handleEstimateAreaDuplicate = async (inclSelections = false) => {
        const result = await handleRequest(async () => {
            await estimates.duplicateArea(estimateIdHash, area.data?.idHash ?? '', inclSelections)
        })

        if (result) {
            duplicateEstimateAreaDialog.close()
            toast.success('Area has been duplicated.')
            await refresh()
        }

        return result
    }

    const handleApplyEstimateDiscount = async (data: IEstimateDiscountInputs, closeOnSubmit: boolean) => {
        return handleRequest(async () => {
            if (editDiscount) {
                await estimates.updateDiscount(estimateIdHash, editDiscount.idHash, data)
            } else {
                await estimates.addDiscount(estimateIdHash, data)
            }
            await refresh()
            if (closeOnSubmit) {
                estimateAreaDialog.current?.close()
            }
        })
    }

    const handleDeleteDiscount = async () => {
        if (!editDiscount?.idHash) {
            return
        }
        return handleRequest(async () => {
            await estimates.deleteDiscount(estimateIdHash, editDiscount.idHash)
            await refresh()
            applyEstimateDiscountDialog.close()
        })

    }

    const handleDeleteArea = async () => {
        if (!area.data?.idHash) {
            return
        }
        try {
            await estimates.deleteArea(estimateIdHash, area.data.idHash)
            deleteEstimateAreaDialog.close()
            await refresh()
            return true
        } catch (error) {
            const message = handleError(error)
            toast.error(message, { autoClose: false })
            return false
        }
    }

    const deleteAssembly = async (assembly: IEstimateEntryModel) => {
        return await handleRequest(async () => {
            await estimates.deleteAssembly(estimateIdHash, assembly.idHash)
            toast.success('Assembly has been removed.')
            await refresh()
            setConfirmDeleteAssembly(undefined)
        })
    }

    const handleAddAssembly = async (assembly: IEstimateAssemblyDbModel, action: AssemblyAction, optionName: string | null, qty: number) => {

        const data: IEstimateAssemblyInput = {
            action,
            assemblyId: assembly.id,
            type: 'E',
            optionName,
            qty
        }

        return await handleRequest(async () => {
            const assembly = await estimates.addAssembly(estimateIdHash, area.data?.idHash ?? '', data)
            toast.success(`${assembly.name} has been added to ${area.data?.name}`)
            await refresh()
        })
    }

    const onUnlockEstimate = async () => {
        return await handleRequest(async () => {
            if (estimateIdHash) {
                await estimates.unlock(estimateIdHash)
                await refresh()
            }
        })
    }

    const onDisableAssemblies = async (disable: boolean) => {
        return await handleRequest(async () => {
            const data = {
                disable,
                assemblyIds: selectedAssemblies
            }
            await estimates.disableAssemblies(estimateIdHash, data)
            await refresh()
        })
    }

    const onDeleteAssemblies = async () => {
        if (!area.data?.idHash) {
            return false
        }
        return handleRequest(async () => {
            await estimates.deleteAssemblies(estimateIdHash, area.data.idHash, selectedAssemblies)
            await refresh()
        })
    }

    const onAreaNotesUpdate = async (content: string) => {
        if (!currentAreaIdHash || currentAreaIdHash.length === 0) {
            return false
        }
        const data: Partial<IEstimateAreaModel> = {
            summary: content
        }
        return handleRequest(async () => {

            await updateSummary(content)

            await estimates.updateArea(estimateIdHash, currentAreaIdHash as string, data)
        })
    }

    const updateSummary = async (content: string) => {
        await queryClient.cancelQueries(['area', estimateIdHash, currentAreaIdHash])

        queryClient.setQueryData(['area', estimateIdHash, currentAreaIdHash], (old) => {
            const data = { ...old as IEstimateAreaModel }
            data.summary = content
            return data
        })
    }

    const onOrderAssemblies = async (assemblies: number[]) => {
        return await handleRequest(async () => {
            await estimates.orderAssemblies(estimateIdHash, { assemblyIds: assemblies })
        })
    }

    const onDeleteAssemblyItem = async (assembly: IEstimateEntryModel, item: IEstimateEntryItemModel) => {
        return await handleRequest(async () => {
            await estimates.deleteAssemblyItem(estimateIdHash, assembly.idHash ?? '', item.idHash)
            await refresh()
        })
    }

    const onUpdateAssemblyItem = async (assembly: IEstimateEntryModel, item: Partial<IEstimateEntryItemModel>) => {
        return await handleRequest(async () => {
            if (item.idHash) {
                await estimates.updateAssemblyItem(estimateIdHash, assembly.idHash, item.idHash, item)
                await refresh()
            }
        })
    }

    const onAddAssemblyItem = async (assembly: IEstimateEntryModel, item: Partial<IEstimateEntryItemModel>) => {
        return await handleRequest(async () => {
            await estimates.addAssemblyItem(estimateIdHash, assembly.idHash, item)
            await refresh()
        })
    }

    const onUpdateAssembly = async (assembly: Partial<IEstimateEntryModel>) => {
        return await handleRequest(async () => {
            await estimates.updateAssembly(estimateIdHash, assembly.idHash ?? '', assembly)
            await refresh()
        })
    }

    const categories = area.data?.categories.filter(category => {
        if (showEmptyCategories) {
            return true
        } else {
            return area.data.entries.filter(entry => entry.categoryId === category.id).length > 0
        }
    })

    const syncSidebar = () => {
        const sidebarEl = document.getElementById('area-sidebar')?.getBoundingClientRect()
        const sidebarStackEl = document.getElementById('area-sidebar-stack')
        const toolbarEl = document.getElementById('estimate-toolbar')
        const toolbarY = toolbarEl?.getBoundingClientRect().y ?? 0

        if (sidebarStackEl) {
            sidebarStackEl.style.setProperty('width', `${(sidebarEl?.width ?? 0) - 20}px`)
            sidebarStackEl.style.setProperty('left', `${(sidebarEl?.left ?? 0) + 20}px`)
            sidebarStackEl.style.setProperty('top', `${toolbarY + 16}px`)
        }

        if (toolbarEl && sidebarEl && isLg) {
            toolbarEl.style.setProperty('padding-left', `${sidebarEl.width}px`)
        } else if (toolbarEl && sidebarEl && !isLg) {
            toolbarEl.style.setProperty('padding-left', `0`)
        }

        const totalsBox = document.getElementById('sidebar-totals-box')
        if (totalsBox && sidebarEl) {
            totalsBox.style.setProperty('width', `${sidebarEl.width - 20}px`)
        }
    }

    const handleColumnResize = () => {
        syncSidebar()
    }

    const debounceColumnResize = useMemo(() => debounce(handleColumnResize, 400), [])

    const onDisableArea = async (area: IEstimateAreaModel) => {
        if (estimate.data?.idHash) {
            await estimates.disableArea(estimate.data.idHash, area.idHash)
            refresh().catch(e => {
            })
        }
    }

    const positionToolbar = () => {
        const toolbarWrapper = document.getElementById('estimate-toolbar')
        const pageHeader = document.querySelector('.page-header')
        if (toolbarWrapper && pageHeader) {
            const toolbarTop = (pageHeader?.getBoundingClientRect().y ?? 0) + (pageHeader?.getBoundingClientRect().height ?? 0)
            toolbarWrapper.style.setProperty('top', `${toolbarTop}px`)
        }
    }

    useEffect(() => {
        positionToolbar()
        window.addEventListener('resize', debounceColumnResize)
        window.addEventListener('scroll', syncSidebar)
        window.addEventListener('scroll', positionToolbar)
        return () => {
            debounceColumnResize.cancel()
            window.removeEventListener('resize', debounceColumnResize)
            window.removeEventListener('scroll', syncSidebar)
            window.removeEventListener('scroll', positionToolbar)
        };
    }, [])

    useEffect(() => {
        syncSidebar()
    }, [areasQuery.isLoading, area.isLoading, estimate.isLoading])


    const address = useAddressFormatter({ ...estimate.data?.project?.house, houseId: estimate.data?.project?.house?.idHash })

    const projectInfoPanelRef = useProjectInfoPanel()

    const handleProjectInfoClick = () => {
        if (projectInfoPanelRef.current && estimate.data?.project) {
            projectInfoPanelRef.current.openPanel(estimate.data.project.idHash)
        }
    }

    const handleAreaReorder = async (areas: IEstimateAreaModel[]) => {
        await queryClient.cancelQueries(['areas', estimateIdHash])

        queryClient.setQueryData(['areas', estimateIdHash], () => {
            return areas
        })
    }

    const areas = areasQuery.data ?? []

    return <>
        <Stack sx={{background:'#fff'}}>
        <EstimateHeader
            isClient={true}
            contracts={estimate.data?.contracts ?? []}
            isPrimary={estimate.data?.primary ?? false}
            loading={estimate.isLoading}
            isLg={isLg}
            handleManageDiscountClick={manageEstimateDiscountDialog.open}
            handleDeleteClick={deleteEstimateDialog.open}
            handleEditClick={editEstimateInfoDialog.open}
            handleApplyDiscountClick={() => {
                setEditDiscount(undefined)
                applyEstimateDiscountDialog.open()
            }}
            address={address}
            price={estimate.data?.totals.price}
            cost={estimate.data?.totals.cost}
            contingency={estimate.data?.totals.contingency}
            discount={estimate.data?.totals.discounts}
            margin={estimate.data?.totals.margin}
            estimateName={estimate.data?.name}
            estimateId={estimate.data?.id}
            estimateIdHash={estimate.data?.idHash}
            sold={estimate.data?.sold}
            selectionsTotal={estimate.data?.selectionProgress?.total ?? 0}
            selectionsApproved={estimate.data?.selectionProgress?.approved ?? 0}
            handleColumnSettingsClick={columnSettingsDialog.open}
            clientName={estimate.data?.project?.contact?.displayNameShort ?? ''}
            onProjectInfoClick={handleProjectInfoClick}
            parent={estimate.data?.project?.parent}
            projectId={estimate.data?.project?.id}
            projectType={estimate.data?.project?.pType}
        />
        <Box className="MuiContainer-root MuiContainer-maxWidthLg" sx={{ paddingLeft:5, paddingRight:2 }}>
        {!!estimate.data?.areaCount &&
            <EstimateToolbar
                isClient={true}
                loading={area.isLoading}
                isLg={isLg}
                estimate={estimate.data}
                selectedAssemblies={selectedAssemblies}
                areas={areas}
                selectedArea={area.data}
                showEmptyCategories={showEmptyCategories}
                showWorkScopes={showWorkScopes}
                handleCategoryButtonClick={() => setShowEmptyCategories(!showEmptyCategories)}
                handleWorkScopeButtonClick={() => setShowWorkScopes(!showWorkScopes)}
                handleAddAssemblyClick={() => {
                    assemblyPanel.open()
                }}
                handleAddComponentClick={() => {
                    componentPanel.open()
                }}
                handleImportFromTemplatesClick={() => {
                    importFromTemplatesDialog.open()
                }}
                onAfterSetMarkup={refresh}
                onAfterMove={async () => {
                    setSelectedAssemblies([])
                    await refresh()
                }}
                onAfterCopy={async () => {
                    setSelectedAssemblies([])
                    await refresh()
                }}
                onAfterDelete={async () => {
                    setSelectedAssemblies([])
                    await refresh()
                }}
                onUnlock={onUnlockEstimate}
                onDisableAssemblies={onDisableAssemblies}
                onDeleteAssemblies={onDeleteAssemblies}
            />
        }
        {areas.length === 0 && !areasQuery.isLoading &&
            <Box display={'flex'} flexGrow={1} mt={6} id={'empty-stage'}>
                <EmptyStage addButtonText={'Add Area'} onAddButtonClick={() => {
                    estimateAreaDialog.current?.open()
                }}>
                    You don’t currently have any areas. Let’s start by adding your first area below.
                </EmptyStage>
            </Box>
        }

        <div
            id={'estimate-workspace'}
            style={{
                flexGrow: 1,
                position: 'relative',
            }}
        >
            <Grid
                columnSpacing={2.5}
                container
                sx={{ '.MuiAccordion-root': { border: '1px solid #EBEAED' } }}
            >
                <Grid id={'area-sidebar'}
                    position={'relative'}
                    xs={12}
                    lg={2}
                    item
                >
                    {isLg && !!estimate.data?.areaCount &&
                        <>

                            <AreaSidebar
                                isClient={true}
                                refreshAddOns={async () => {
                                    await estimate.refetch()
                                }}
                                estimate={estimate.data}
                                loading={areasQuery.isLoading}
                                discounts={estimate.data?.discounts}
                                handleAreaClick={(area, index) => {
                                    setSelectedAreaIndex(index)
                                }}
                                handleAreaReorder={handleAreaReorder}
                                handleDeleteClick={deleteEstimateAreaDialog.open}
                                handleEditClick={(area) => {
                                    setEditArea(area)
                                    estimateAreaDialog.current?.open()
                                }}
                                handleDuplicateClick={duplicateEstimateAreaDialog.open}
                                handleAddClick={() => {
                                    setEditArea(undefined)
                                    estimateAreaDialog.current?.open()
                                }}
                                estimateIdHash={estimate.data?.idHash}
                                cost={estimate.data?.totals.cost}
                                price={estimate.data?.totals.price}
                                subtotal={estimate.data?.totals.subtotal}
                                discountAmount={estimate.data?.totals.discounts}
                                sold={estimate.data?.sold}
                                area={area.data}
                                areas={areas}
                                onDisableArea={() => {
                                    if (area.data) {
                                        onDisableArea(area.data).catch(e => console.error(e))
                                    }
                                }}
                                handleChangeCategoryOrder={handleChangeCategoryOrder}
                                addOns={estimate.data?.promptEntry?.prompt?.addOns}
                                estimateAddOns={estimate.data?.estimateAddOns}
                            />
                        </>
                    }
                </Grid>
                <Grid xs={12} lg={10} pr={'1px'} position={'relative'} item>
                    {area.isLoading && !!estimate.data?.areaCount &&
                        <Stack gap={2}>
                            <Skeleton component={'div'} height={'66px'} variant={'rectangular'} />
                            <Skeleton component={'div'} height={'66px'} variant={'rectangular'} />
                            <Skeleton component={'div'} height={'66px'} variant={'rectangular'} />
                        </Stack>
                    }
                    {!area.isLoading && estimate.data &&
                        <>
                            {area.data &&
                                <div>
                                    <AreaNotes
                                        area={area.data}
                                        estimate={estimate.data}
                                        onUpdate={onAreaNotesUpdate}
                                    />


                                    {categories?.map(category => {
                                        return <CategoryEntries
                                            isLg={isLg}
                                            key={`category-section-${estimateIdHash}-${category.id}`}
                                            category={category}
                                            handleAddItemClick={handleAddItemClick}
                                            handleSelectedEntriesChanged={handleSelectedEntriesChanged}
                                            handleEditClick={handleEditAssemblyClick}
                                            showWorkScopes={showWorkScopes}
                                            area={area.data}
                                            selectedAssemblies={selectedAssemblies}
                                            estimate={estimate.data}
                                            entryTableColumnSettings={entryTableColumns}
                                            entryTableColumns={entryTableColumns}
                                            onOrderAssemblies={onOrderAssemblies}
                                            updateAssembly={onUpdateAssembly}
                                            setConfirmDeleteAssembly={setConfirmDeleteAssembly}
                                        />
                                    })}
                                    {!Boolean(area.data.categories?.length) &&
                                        <EmptyStage
                                            addButtonText={'Add New Assemblies'}
                                            onAddButtonClick={() => assemblyPanel.open()}
                                        >
                                            <Typography>
                                                No assemblies have been added to the <Typography fontWeight={'bold'}
                                                    component={'strong'}>&ldquo;{area.data.name}&rdquo;</Typography> area.
                                            </Typography>
                                        </EmptyStage>
                                    }

                                </div>
                            }

                            {features?.estimatingStrategy === 'hybrid' &&
                                <Menu
                                    open={hybridEstimateAddMenu.open}
                                    anchorEl={hybridEstimateAddMenu.anchorEl}
                                    onClose={hybridEstimateAddMenu.onClose}
                                    sx={{ mt: 1 }}
                                    anchorOrigin={{
                                        vertical: 'bottom',
                                        horizontal: 'right',
                                    }}
                                    transformOrigin={{
                                        vertical: 'top',
                                        horizontal: 'right',
                                    }}
                                    PaperProps={{
                                        sx: {
                                            minWidth: '220px',
                                            overflow: 'visible',
                                            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                                            mt: 1.5,
                                            '&:before': {
                                                content: '""',
                                                display: 'block',
                                                position: 'absolute',
                                                top: 0,
                                                right: 12,
                                                width: 10,
                                                height: 10,
                                                bgcolor: 'background.paper',
                                                transform: 'translateY(-50%) rotate(45deg)',
                                                zIndex: 0,
                                            },
                                        }
                                    }}
                                >
                                    <MenuItem
                                        onClick={() => {
                                            setItemPanelCategory(categoryRef.current)
                                            hybridEstimateAddMenu.onClose()
                                        }}
                                    >
                                        Add Item
                                    </MenuItem>
                                    <MenuItem
                                        onClick={() => {
                                            setAssemblyPanelCategory(categoryRef.current ?? undefined)
                                            hybridEstimateAddMenu.onClose()
                                        }}
                                    >
                                        Add Assembly
                                    </MenuItem>
                                </Menu>
                            }
                        </>
                    }
                </Grid>
            </Grid>
        </div>

        {estimate.data &&
            <>
                {estimate.data.promptEntry?.idHash &&
                    <div style={{ textAlign: 'right' }}>
                        <RouterLink to={`/prompts/${estimate.data.promptEntry?.prompt?.idHash}/entries/${estimate.data.promptEntry?.idHash}`}>Return to Wizard</RouterLink>
                    </div>
                }

                <Dialog fullWidth={true} maxWidth={'xs'} open={Boolean(confirmDeleteAssembly)}>
                    <ConfirmDialog
                        title={'Confirm Delete'}
                        confirmButtonText={'Delete Assembly'}
                        onCancel={() => setConfirmDeleteAssembly(undefined)}
                        onConfirm={async () => {
                            if (confirmDeleteAssembly) {
                                await deleteAssembly(confirmDeleteAssembly)
                            }
                        }}
                    >
                        Are you sure you want to remove <strong>&ldquo;{confirmDeleteAssembly?.name}&rdquo;</strong> from this estimate?
                    </ConfirmDialog>
                </Dialog>

                <Dialog fullWidth={true} maxWidth={'xs'} open={deleteEstimateAreaDialog.isOpen}>
                    <ConfirmDialog
                        onCancel={deleteEstimateAreaDialog.close}
                        onConfirm={async () => {
                            await handleDeleteArea()
                        }}
                        confirmButtonText={'Delete Area'}
                        title={'Confirm'}
                    >
                        <Typography component={'p'}>
                            Are you sure you want to delete <Typography fontWeight={'bold'} component={'strong'}>&ldquo;{area.data?.name}&rdquo;</Typography>? Any associated entries will also be removed from the estimate.
                        </Typography>
                    </ConfirmDialog>
                </Dialog>

                <Dialog fullWidth={true} maxWidth={'sm'} open={duplicateEstimateAreaDialog.isOpen}>
                    <EstimateDuplicateAreaDialog
                        onCancel={duplicateEstimateAreaDialog.close}
                        onConfirm={handleEstimateAreaDuplicate}
                    >
                        <Typography component={'p'}>
                            Would you like to copy your selections into the new area?
                        </Typography>
                    </EstimateDuplicateAreaDialog>
                </Dialog>

                <Dialog fullWidth={true} maxWidth={'xs'} open={deleteEstimateDialog.isOpen} onBackdropClick={deleteEstimateDialog.close}>
                    <ConfirmDialog confirmButtonText={'Delete Estimate'} onCancel={deleteEstimateDialog.close} onConfirm={async () => {
                        await deleteEstimate(estimate.data)
                    }}>
                        <Typography>
                            Are you sure you want to delete the estimate <Typography fontWeight={'bold'} component={'strong'}>&ldquo;{estimate.data.name}&rdquo;</Typography>?
                        </Typography>
                    </ConfirmDialog>
                </Dialog>

                <EstimateDialog
                    open={editEstimateInfoDialog.isOpen}
                    onClose={editEstimateInfoDialog.close}
                    onSubmit={handleUpdateEstimateInfo}
                    projectId={estimate.data.projectId}
                    estimate={estimate.data}
                    financingPlans={financingPlansQuery.data}
                />

                <EstimateAreaDialog
                    estimate={estimate.data}
                    handleSubmit={handleEstimateAreaDialogSubmit}
                    handleClose={() => {
                        estimateAreaDialog.current?.close()
                    }}
                    area={editArea}
                    ref={estimateAreaDialog}
                />

                <EstimateDiscountDialog
                    open={applyEstimateDiscountDialog.isOpen}
                    onClose={applyEstimateDiscountDialog.close}
                    onSubmit={handleApplyEstimateDiscount}
                    estimate={estimate.data}
                    discountModel={editDiscount}
                    discountIndex={(selectedDiscountIndex + 1)}
                    handleDeleteClick={handleDeleteDiscount}
                />

                <EstimateManageDiscountDialog
                    open={manageEstimateDiscountDialog.isOpen}
                    onClose={manageEstimateDiscountDialog.close}
                    discounts={estimate.data.discounts}
                    estimatePrice={estimate.data.totals.subtotal}
                    totalDiscount={estimate.data.totals.discounts}
                    handleDiscountClick={(discount, index) => {
                        setSelectedDiscountIndex(index)
                        setEditDiscount(discount)
                        applyEstimateDiscountDialog.open()
                    }}
                    handleApplyDiscountClick={() => {
                        setEditDiscount(undefined)
                        applyEstimateDiscountDialog.open()
                    }}
                />

                <ColumnSettings
                    isClient={true}
                    open={columnSettingsDialog.isOpen}
                    onCloseClick={columnSettingsDialog.close}
                    entryTableColumns={entryTableColumns}
                    entryTableColumnSettings={entryTableColumns}
                    setEntryTableGlobalColumnSettings={async (settings) => {
                        //setGlobalColumnSettings(JSON.stringify(settings))
                        return true
                    }}
                    setEntryTableColumnSettings={async (settings) => {
                        //setColumnSettings(JSON.stringify(settings))
                        return true
                    }}
                />

                {area.data &&
                    <>
                        <AssemblyPanel
                            projectIdHash={estimate.data.projectIdHash}
                            opportunityType={estimate.data.project?.opportunityType}
                            open={assemblyPanel.isOpen}
                            onCloseButtonClick={() => {
                                setAssemblyPanelCategory(undefined)
                                assemblyPanel.close()
                                categoryRef.current = null
                            }}
                            title={'Add New Assembly'}
                            category={assemblyPanelCategory}
                            handleAddAssembly={handleAddAssembly}
                            area={area.data}
                            categories={area.data.categories}
                        />
                        <ComponentPanel
                            exclude={[]}
                            type={''}
                            open={componentPanel.isOpen}
                            category={itemPanelCategory}
                            area={area.data}
                            onClose={() => {
                                componentPanel.close()
                                categoryRef.current = null
                                setItemPanelCategory(null)
                            }}
                            onAddItem={async (item, qty) => {
                                const payload = {
                                    estimateIdHash: estimate.data?.idHash ?? '',
                                    areaIdHash: area.data?.idHash ?? '',
                                    data: { estimateItemDbId: item.id, qty: qty }
                                }
                                addComponentMutation.mutate(payload, {
                                    onSuccess: async () => {
                                        await refresh()
                                        toast.success(`${item.label} has been added to the estimate.`)
                                    },
                                    onError: (e) => {
                                        toast.error(handleError(e), { autoClose: false })
                                    }
                                })
                            }}
                        />
                        <EditAssemblyPanel
                            onDeleteAssemblyItem={onDeleteAssemblyItem}
                            onUpdateAssemblyItem={onUpdateAssemblyItem}
                            estimate={estimate.data}
                            units={units}
                            onAddAssemblyItem={onAddAssemblyItem}
                            onUpdateAssembly={onUpdateAssembly}
                            areas={areas}
                            ref={editAssemblyDialogRef}
                            refresh={refresh}
                        />
                        <ReorderCategoriesPanel
                            areaIdHash={area.data.idHash}
                            estimateIdHash={estimate.data.idHash}
                            subtitle={area.data.name}
                            onCategoryReorder={onCategoryReorder}
                            ref={reorderCategoriesPanelRef}
                        />

                        {!isLg &&
                            <AreaListMobile
                                areas={areas}
                                selectedAreaIdHash={area.data.idHash}
                                sold={estimate.data.sold}
                                onAreaClick={(areaIdHash) => {
                                    const index = areas.findIndex(a => a.idHash === areaIdHash) ?? 0
                                    setSelectedAreaIndex(index)
                                }}
                                onDeleteAreaClick={deleteEstimateAreaDialog.open}
                                onUpdateAreaClick={(area) => {
                                    setEditArea(area)
                                    estimateAreaDialog.current?.open()
                                }}
                                onDuplicateAreaClick={duplicateEstimateAreaDialog.open}
                                onChangeCategoryOrderClick={handleChangeCategoryOrder}
                                onDisableAreaClick={() => onDisableArea(area.data)}
                                onAddAreaClick={() => {
                                    setEditArea(undefined)
                                    estimateAreaDialog.current?.open()
                                }}
                            />
                        }
                    </>
                }

                <ProjectInfoPanel
                    ref={projectInfoPanelRef}
                    hiddenSections={[]}
                    hiddenFields={['cost', 'totalEstCost']}
                />

                {area.data?.idHash &&
                    <ImportFromTemplatesDialog
                        open={importFromTemplatesDialog.isOpen}
                        onCancel={importFromTemplatesDialog.close}
                        onClose={importFromTemplatesDialog.close}
                        onBackdropClick={importFromTemplatesDialog.close}
                        maxWidth={'sm'}
                        fullWidth={true}
                        afterSubmit={async () => {
                            await refresh()
                            importFromTemplatesDialog.close()
                        }}
                        estimateIdHash={estimateIdHash}
                        areaIdHash={area.data.idHash}
                    />
                }
            </>
        }
        </Box>
        </Stack>
    </>
}

interface ImportFromTemplatesDialogProps extends DialogProps {
    afterSubmit: (templates: IEstimateTemplateModel[]) => void
    onCancel?: () => void
    estimateIdHash: string
    areaIdHash: string
}

const ImportFromTemplatesDialog: FC<ImportFromTemplatesDialogProps> = (props) => {
    const {
        afterSubmit,
        onCancel,
        estimateIdHash,
        areaIdHash,
        ...rest
    } = props

    const [templates, setTemplates] = useState<IEstimateTemplateModel[]>([])
    const [loading, setLoading] = useState(false)
    const estimates = useEstimates()

    return <Dialog
        {...rest}
    >
        <DialogTitle>Add Assemblies From Templates</DialogTitle>
        <DialogContent>
            <TemplatePicker onChange={(templates) => setTemplates(templates)} />
        </DialogContent>
        <DialogActions>
            <Button variant={'text'} onClick={onCancel}>
                Cancel
            </Button>
            <CircularProgressButton
                loading={loading}
                variant={'contained'}
                color={'success'}
                onClick={async () => {
                    // http request, then call after submit
                    try {
                        setLoading(true)
                        await estimates.addAssembliesFromTemplates(estimateIdHash, areaIdHash, templates.map(t => t.id))
                        afterSubmit(templates)
                    } catch (error) {
                        console.error(error)
                    }
                    setLoading(false)
                }}
            >
                Add Assemblies
            </CircularProgressButton>
        </DialogActions>
    </Dialog>

}

export default EstimateView
