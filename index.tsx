import React, { FC, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import { Autocomplete, Fab, SxProps, TextField, useMediaQuery, useTheme } from "@mui/material";
import { usePageTitle } from "../../hooks/page-title";
import { useTrackHistory } from "../../hooks/breadcrumbs";
import DashboardWidget from "./components/widgets/DashboardWidget";
import Tasks from "./components/widgets/Tasks";
import { Responsive, WidthProvider } from "react-grid-layout";
import useDashboardSupport, {
    IDashboardWidget,
    WidgetPeriodEnum
} from "./hooks/dashboard-support";
import DashboardContext from "./context";
import { useImperativeDialog } from "../../components/dialogs/ImperativeDialog";
import ManageWidgetsDialog from "./components/ManageWidgetsDialog";
import { SettingsOutlined } from "@mui/icons-material";
import useDashboardContext from "../../hooks/dashboard-context";
import { useLocalStorage } from "../../hooks/local-storage";
import { useMetadataStore } from "../../store/metadata";
import { useCustomFieldLabels } from "../../components/form/CustomField";
import { IIdentityModel } from "../../interfaces";

import "./../../../src/styles/custom.css"
import { IOpportunityType } from "../../interfaces/forms";


const ResponsiveGridLayout = WidthProvider(Responsive);

const DashboardIndex: FC = () => {
    usePageTitle('Dashboard')
    const theme = useTheme()
    const isLg = useMediaQuery(theme.breakpoints.up('lg'), { noSsr: true })

    const trackHistory = useTrackHistory()
    useEffect(() => {
        const history = {
            title: 'Dashboard',
            url: window.location.href
        }
        trackHistory(history)
    }, [])

    useEffect(() => {
        document.getElementById('main-container')?.style.setProperty('padding', '0')
        document.body.classList.add('has--grey-background')
        return () => {
            document.getElementById('main-container')?.style.removeProperty('padding')
            document.body.classList.remove('has--grey-background')
        }
    }, [])

    const style: SxProps = {
        '.dashboard__columns': {
            display: 'flex',
            flexDirection: isLg ? 'row' : 'column',
            gap: 4,
            marginLeft: isLg ? '50px' : '24px',
            marginRight: isLg ? undefined : '24px',
            '.dashboard__left': {
                pt: isLg ? 3 : undefined,
                pb: isLg ? 3 : undefined,
                flex: isLg ? `0 0 calc(100% - 490px)` : undefined,
                maxWidth: isLg ? `calc(100% - 490px)` : undefined,
            },
            '.dashboard__right': {
                flex: isLg ? '0 0 458px' : undefined,
                maxWidth: isLg ? '458px' : undefined,
                borderLeft: isLg ? '1px solid #EBEAED' : undefined
            }
        },
        '.dashboard__kpi': {
            background: 'white',
            pb: 4,
            borderBottom: '1px solid #EBEAED',
            '.dashboard__kpi_list': {
                minHeight: '152px',
            }
        },
        '.react-grid-item': {
            '.dashboard__widget': {
                height: '100%',
            },
        },
        '.react-resizable-handle': {
            position: 'absolute',
            width: '16px',
            height: '16px',
            right: 0,
            bottom: 0,
            '&::after': {
                content: '""',
                position: 'absolute',
                right: '3px',
                bottom: '3px',
                width: '5px',
                height: '5px',
                borderRight: '2px solid rgba(0, 0, 0, 0.4)',
                borderBottom: '2px solid rgba(0, 0, 0, 0.4)'
            }
        },
        '.react-grid-layout': {
            position: 'relative'
        }
    }

    const {
        rowHeight,
        margin,
        cols,
        breakpoints,
        layouts,
        setLayouts,
        getInstanceHeight,
        activeWidgets,
        toggleWidget,
        load,
        getWidget,
        filter,
        setFilter,
        widgets,
    } = useDashboardSupport()

    const layoutRef = useRef<HTMLDivElement>(null)

    const dialogRef = useImperativeDialog()

    const dashboardContextValue = {
        loadWidgetData: load,
        getWidget,
        filter,
        widgets,
        activeWidgets,
        removeWidget: async (widgetId: string) => {
            await toggleWidget(widgetId)
        },
        setFilter,
    }

    const [width, setWidth] = useState<number | null>(null)

    useEffect(() => {
        const w = document.querySelector('.dashboard__left')?.getBoundingClientRect().width
        if (w) {
            setWidth(w)
        }
    }, [])

    return <DashboardContext.Provider value={dashboardContextValue}>
        <ManageWidgetsDialog
            ref={dialogRef}
            onBackdropClick={() => dialogRef.current?.closeDialog()}
            onCloseButtonClick={() => dialogRef.current?.closeDialog()}
            onToggleWidget={toggleWidget}
        />
        <Fab variant='extended' sx={{ position: 'fixed', bottom: '16px', right: '16px' }} color={'success'} onClick={() => dialogRef.current?.openDialog()}>
            <SettingsOutlined style={{ marginRight: '4px' }} />
            Manage Widgets
        </Fab>
        <Box sx={style} className={'dashboard-index'}>
            <div className={'dashboard__columns'}>
                <div ref={layoutRef} className={'dashboard__left'}>
                    {/* <DashboardFilter /> */}
                    {!!width &&
                        <ResponsiveGridLayout
                            measureBeforeMount={true}
                            isResizable={true}
                            className={'layout'}
                            layouts={layouts}
                            breakpoints={breakpoints}
                            cols={cols}
                            rowHeight={rowHeight}
                            margin={[margin, margin]}
                            containerPadding={[0, 24]}
                            draggableHandle={'.dashboard__widget_drag_indicator'}
                            onLayoutChange={(currentLayout, allLayouts) => {
                                setLayouts(allLayouts)
                                window.dispatchEvent(new Event('resize')) // force resize of charts
                            }}
                        >
                            {activeWidgets.map(widget => {
                                const supportsHeight = widget.supports?.includes('height')
                                const height = supportsHeight ? getInstanceHeight(widget.id) : 0
                                return <div key={widget.id}>
                                    <Widget widget={widget} height={height}/>
                                </div>
                            })}
                        </ResponsiveGridLayout>
                    }

                </div>
                <div className={'dashboard__right'}>
                    <Tasks />
                </div>
            </div>
        </Box>
    </DashboardContext.Provider>
}

const Widget: FC<{ widget: IDashboardWidget, height: number }> = (props) => {
    const {
        widget,
        height,
    } = props
    const dashboardContext = useDashboardContext()

    const defaultPeriod = widget.defaults?.period ?? WidgetPeriodEnum.ThisWeek

    const [period, setPeriod] = useLocalStorage(`${widget.id}-filter`, defaultPeriod)
    const [user, setUser] = useLocalStorage(`${widget.id}-user-filter`, 'all')
    const [division, setDivison] = useLocalStorage(`${widget.id}-division-filter`, 'all')

    const teamMemberFilterValue = dashboardContext.filter.get('teamMember')

    const opportunityTypeFilterValue = dashboardContext.filter.get('opportunityType')

    const users = useMetadataStore(state => state.users)

    const teamMember = users.find(u => u.id.toString() === teamMemberFilterValue)

    const opportunityTypes = useMetadataStore(state => state.opportunityTypes)
    const opportunityType = opportunityTypes.find(ot => ot.id.toString() === opportunityTypeFilterValue)

    const companyOrUser = widget.supports?.includes('teamMember') && teamMemberFilterValue ? (teamMember?.displayName ?? 'Unknown Member') : 'All Company'

    const subtitleParts = [companyOrUser]

    if (opportunityType) {
        subtitleParts.push(opportunityType.oppType)
    }

    return <DashboardWidget
        title={widget.title}
        subtitle={subtitleParts.join(' / ')}
        id={widget.id}
        theme={widget.theme}
        period={period}
        onPeriodChange={setPeriod}
        user={user}
        onUserChange={setUser}
        division={division}
        onDivisionChange={setDivison}
    >
        <ResolveComponent widget={widget} height={height} period={period} user={user} opportunityType={division} />

    </DashboardWidget>
}

const ResolveComponent: FC<{ widget: IDashboardWidget, height: number, period?: WidgetPeriodEnum, user?:IIdentityModel, opportunityType?: IOpportunityType}> = (props) => {

     const SalesPerformance = React.lazy(() => import(/* webpackChunkName: "dashboard-component-SalesPerformance" */ '../../components/dashboard/widgets/SalesPerformance'))
    const RecentProjectNotesChanges = React.lazy(() => import(/* webpackChunkName: "dashboard-component-RecentProjectNotesChanges" */ './components/widgets/RecentProjectNotesChanges'))
    const SalesTotal = React.lazy(() => import(/* webpackChunkName: "dashboard-component-SalesTotal" */ './components/widgets/SalesTotal'))
    const CallReport = React.lazy(() => import(/* webpackChunkName: "dashboard-component-CallReport" */ './components/widgets/CallReport'))
    const ClientConcerns = React.lazy(() => import(/* webpackChunkName: "dashboard-component-ClientConcerns" */ './components/widgets/ClientConcerns'))
    const FirstAppointmentBacklog = React.lazy(() => import(/* webpackChunkName: "dashboard-component-FirstAppointmentBacklog" */ './components/widgets/FirstAppointmentBacklog'))
    const ProductionReport = React.lazy(() => import(/* webpackChunkName: "dashboard-component-ProductionReport" */ './components/widgets/ProductionReport'))
    const PermitWidget = React.lazy(() => import(/* webpackChunkName: "dashboard-component-PermitWidget" */ './components/widgets/PermitWidget'))
    const ActivityTasks = React.lazy(() => import(/* webpackChunkName: "dashboard-component-ActivityTasks" */ './components/widgets/ActivityTasks'))
    const RecentCommunication = React.lazy(() => import(/* webpackChunkName: "dashboard-component-RecentCommunication" */ './components/widgets/RecentCommunication'))
    const OpenLead = React.lazy(() => import(/* webpackChunkName: "dashboard-component-OpenLead" */ './components/widgets/OpenLead'))
    const Backlog = React.lazy(() => import(/* webpackChunkName: "dashboard-component-Backlog" */ './components/widgets/Backlog'))
    const LeadsAppointments =  React.lazy(() => import(/* webpackChunkName: "dashboard-component-TargetInfographic" */ './components/widgets/LeadsAppointments'))
    const SalesPerformanceNew = React.lazy(() => import(/* webpackChunkName: "dashboard-component-SalesPerformanceNew" */ './components/widgets/SalesPerformanceNew'))
    const PurchasingBacklog = React.lazy(() => import(/* webpackChunkName: "dashboard-component-PurchasingBacklog" */ './components/widgets/PurchasingBacklog'))
    const ProductionPipeline = React.lazy(() => import(/* webpackChunkName: "dashboard-component-ProductionPipeline" */ './components/widgets/ProductionPipeline'))
    const SalesPipeline = React.lazy(() => import(/* webpackChunkName: "dashboard-component-SalesPipeline" */ './components/widgets/SalesPipline'))

    const {
        widget,
        height,
        period,
        user,
        opportunityType
    } = props



    if (widget.componentName === 'ProductionReport') {
        return <ProductionReport
            id={widget.id}
            {...widget.defaults}
            height={height}
            user={user}
        />
    }

    if (widget.componentName === 'purchasingBacklog') {
        return <PurchasingBacklog
            id={widget.id}
            {...widget.defaults}
            height={height}
            user={user}
        />
    }

    if (widget.componentName === 'OpenLead') {
        return <OpenLead
            id={widget.id}
            {...widget.defaults}
            height={height}
            user={user}
        />
    }

    if (widget.componentName === 'ActivityTasks') {
        return <ActivityTasks
            id={widget.id}
            {...widget.defaults}
            height={height}
            user={user}
        />
    }

    if (widget.componentName === 'RecentCommunication') {
        return <RecentCommunication
            id={widget.id}
            {...widget.defaults}
            height={height}
            user={user}
        />
    }

    if (widget.componentName === 'RecentProjectNotesChanges') {
        return <RecentProjectNotesChanges
        id={widget.id}
        {...widget.defaults}
        height={height}
        period={period}
        user={user}
        />
    }


    if (widget.componentName === 'SalesPerformance') {
        return(

         <SalesPerformanceNew
            id={widget.id}
            {...widget.defaults}
            height={height}
            period={period}
            user={user}
        />
        )
    }

    if (widget.componentName === 'SalesTotal') {
        return <SalesTotal
            id={widget.id}
            {...widget.defaults}
            height={height}
            user={user}
        />
    }

    if (widget.componentName === 'CallReport') {
        return <CallReport
            id={widget.id}
            {...widget.defaults}
            height={height}
            user={user}
        />
    }
    if (widget.componentName === 'ClientConcerns') {
        return <ClientConcerns
            id={widget.id}
            {...widget.defaults}
            height={height}
            user={user}
        />
    }

    if (widget.componentName === 'PermitWidget') {
        return <PermitWidget
            id={widget.id}
            {...widget.defaults}
            height={height}
            user={user}
        />
    }


    if (widget.componentName === 'FirstAppointmentBacklog') {
        return <FirstAppointmentBacklog
            id={widget.id}
            {...widget.defaults}
            height={height}
            user={user}
        />
    }
    if (widget.componentName === 'leadsAppointments') {
        return <LeadsAppointments
            id={widget.id}
            {...widget.defaults}
            height={height}
            user={user}
        />
    }


    if (widget.componentName === 'Backlog') {
        return <Backlog
            id={widget.id}
            {...widget.defaults}
            height={height}
        />
    }

    if (widget.componentName === 'ProductionPipeline') {
        return <ProductionPipeline
            id={widget.id}
            {...widget.defaults}
            height={height}
            user={user}
            opportunityType={opportunityType}
        />
    }

    if (widget.componentName === 'SalesPipeline') {
        return <SalesPipeline
            id={widget.id}
            {...widget.defaults}
            height={height}
            user={user}
        />
    }


    return <div>Could not resolve component &ldquo;{widget.componentName}&rdquo;</div>
}

const DashboardFilter: FC = () => {
    const dashboardContext = useDashboardContext();

    const users = useMetadataStore(state => state.users);

    const userOptions = [
        { label: "All", value: "all" }, // Add "All" option
        ...users.map(u => ({
            label: u.displayName,
            value: u.id.toString()
        }))
    ];

    const opportunityTypes = useMetadataStore(state => state.opportunityTypes);
    const opportunityTypeOptions = [
        { label: "All", value: "all" }, // Add "All" option
        ...opportunityTypes.map(o => ({
            label: o.oppType,
            value: o.id.toString()
        }))
    ];

    const getArrayFromParams = (param: string) => {
        const values = dashboardContext.filter.getAll(param);
        return values.length ? values : [];
    };

    const [user, setUser] = useState<string[]>(getArrayFromParams('teamMember'));
    const [opportunityType, setOpportunityType] = useState<string[]>(getArrayFromParams('opportunityType'));

    const style = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '16px',
        '.MuiOutlinedInput-notchedOutline': {
            borderWidth: '1px',
            borderColor: '#EBEAED',
            borderRadius: '4px',
        },
        '.MuiAutocomplete-root': {
            width: '200px',
        },
        '.MuiFormControl-root': {
            mb: 0,
        }
    };

    const selectedUsers = userOptions.filter(u => user.includes(u.value));
    const selectedOpportunityTypes = opportunityTypeOptions.filter(o => opportunityType.includes(o.value));

    const mutateFilter = (param: 'teamMember[]' | 'opportunityType[]', values: string[]) => {
        const filter = new URLSearchParams(dashboardContext.filter.toString());
        filter.delete(param); // Clear existing values
        values.forEach(value => filter.append(param, value)); // Append as separate query params
        dashboardContext.setFilter(filter);
    };

    const { getLabel } = useCustomFieldLabels();
    const opportunityTypeLabel = getLabel("projects", 'opportunity_type_id', "Opportunity Type");

    return (
        <Box sx={style} className={'dashboard-filters'}>
            <div className={'dashboard-filter'}>
                <Autocomplete
                    multiple
                    renderInput={(params) => <TextField {...params} label="Team Member" />}
                    options={userOptions}
                    value={selectedUsers}
                    onChange={(event, values) => {
                        const selectedValues = values.map(v => v.value);
                        setUser(selectedValues);
                        mutateFilter('teamMember[]', selectedValues);
                    }}
                />
            </div>
            <div className={'dashboard-filter'}>
                <Autocomplete
                    multiple
                    style={{ width: '180px' }}
                    renderInput={(params) => <TextField {...params} label={opportunityTypeLabel} />}
                    options={opportunityTypeOptions}
                    value={selectedOpportunityTypes}
                    onChange={(event, values) => {
                        const selectedValues = values.map(v => v.value);
                        setOpportunityType(selectedValues);
                        mutateFilter('opportunityType[]', selectedValues);
                    }}
                />
            </div>
        </Box>
    );
};

export default DashboardIndex
